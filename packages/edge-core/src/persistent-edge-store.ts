import { mkdir, open, readFile, rename, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname } from 'node:path';
import { EdgeAckRecord, EdgeCommandRecord, EdgePersistentState, EdgeTelemetryEnvelope } from './edge-reliability.types';

const EMPTY = (): EdgePersistentState => ({ version: 1, telemetry: [], commands: [], acks: [], lastSequence: {} });

export class PersistentEdgeStore {
  private state: EdgePersistentState = EMPTY();
  private writes = Promise.resolve();

  constructor(private readonly path: string, private readonly limits = { maxQueueSize: 10_000, maxStorageBytes: 64 * 1024 * 1024, retentionMs: 30 * 24 * 60 * 60_000 }) {}

  async open() {
    await mkdir(dirname(this.path), { recursive: true });
    try { this.state = JSON.parse(await readFile(this.path, 'utf8')) as EdgePersistentState; }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; this.state = EMPTY(); await this.persist(); }
    for (const item of [...this.state.telemetry, ...this.state.acks]) if (item.status === 'SENDING' || (item as any).queueStatus === 'SENDING') {
      if ('queueStatus' in item) item.queueStatus = 'PENDING'; else item.status = 'PENDING';
    }
    this.expireAcknowledged();
    await this.persist();
    return this;
  }

  snapshot() { return structuredClone(this.state); }

  async enqueueTelemetry(item: EdgeTelemetryEnvelope) {
    const duplicate = this.state.telemetry.find((entry) => entry.messageId === item.messageId);
    if (duplicate) return { inserted: false, item: duplicate };
    this.ensureCapacity('TELEMETRY');
    this.state.telemetry.push(item); await this.persist(); return { inserted: true, item };
  }

  async enqueueAck(item: EdgeAckRecord) {
    const existing = this.state.acks.find((entry) => entry.commandId === item.commandId && entry.status === item.status);
    if (existing) return { inserted: false, item: existing };
    this.ensureCapacity(item.priority); this.state.acks.push(item); await this.persist(); return { inserted: true, item };
  }

  command(commandId: string) { return this.state.commands.find((item) => item.commandId === commandId); }
  async saveCommand(item: EdgeCommandRecord) {
    const index = this.state.commands.findIndex((entry) => entry.commandId === item.commandId);
    if (index >= 0) this.state.commands[index] = item; else this.state.commands.push(item);
    this.state.lastCommandReceived = item.receivedAt; await this.persist();
  }

  nextBatch(batchSize: number) {
    const acks = this.state.acks.filter((item) => item.queueStatus === 'PENDING');
    const telemetry = this.state.telemetry.filter((item) => item.status === 'PENDING').sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return [...acks, ...telemetry].slice(0, batchSize);
  }

  async markSending(item: EdgeTelemetryEnvelope | EdgeAckRecord) {
    const now = new Date().toISOString(); item.attemptCount += 1; item.lastAttemptAt = now;
    if ('queueStatus' in item) item.queueStatus = 'SENDING'; else item.status = 'SENDING'; await this.persist();
  }
  async markPending(item: EdgeTelemetryEnvelope | EdgeAckRecord) { if ('queueStatus' in item) item.queueStatus = 'PENDING'; else item.status = 'PENDING'; await this.persist(); }
  async markUploaded(item: EdgeTelemetryEnvelope | EdgeAckRecord) {
    const now = new Date().toISOString();
    if ('queueStatus' in item) { item.queueStatus = 'ACKNOWLEDGED'; this.state.lastAckUploaded = now; }
    else item.status = 'ACKNOWLEDGED';
    this.state.lastSuccessfulUpload = now; await this.persist();
  }

  sequence(deviceId: string) { return this.state.lastSequence[deviceId]; }
  async rememberSequence(deviceId: string, sequence: number) { this.state.lastSequence[deviceId] = Math.max(sequence, this.state.lastSequence[deviceId] ?? sequence); await this.persist(); }
  pendingDepth() { return this.state.telemetry.filter((x) => x.status !== 'ACKNOWLEDGED').length + this.state.acks.filter((x) => x.queueStatus !== 'ACKNOWLEDGED').length; }
  oldestPendingAge(now = Date.now()) {
    const timestamps = [...this.state.telemetry.filter((x) => x.status === 'PENDING').map((x) => x.createdAt), ...this.state.acks.filter((x) => x.queueStatus === 'PENDING').map((x) => x.timestamp)];
    return timestamps.length ? Math.max(0, now - Math.min(...timestamps.map(Date.parse))) : 0;
  }
  async storageUsage() { try { return (await stat(this.path)).size; } catch { return 0; } }
  storageState(usage: number) { return usage >= this.limits.maxStorageBytes * 0.9 ? 'CRITICAL' : usage >= this.limits.maxStorageBytes * 0.75 ? 'WARNING' : 'GOOD'; }

  private ensureCapacity(priority: string) {
    if (this.pendingDepth() < this.limits.maxQueueSize) return;
    if (priority === 'TELEMETRY' || priority === 'BACKGROUND') throw new Error('EDGE_QUEUE_FULL_TELEMETRY_REJECTED');
    const index = this.state.telemetry.findIndex((item) => item.status === 'PENDING');
    if (index >= 0) { this.state.telemetry.splice(index, 1); return; }
    throw new Error('EDGE_QUEUE_CRITICAL_CAPACITY_EXHAUSTED');
  }
  private expireAcknowledged() {
    const cutoff = Date.now() - this.limits.retentionMs;
    this.state.telemetry = this.state.telemetry.filter((item) => item.status !== 'ACKNOWLEDGED' || Date.parse(item.createdAt) >= cutoff);
    this.state.acks = this.state.acks.filter((item) => item.queueStatus !== 'ACKNOWLEDGED' || Date.parse(item.timestamp) >= cutoff);
  }
  private persist() {
    this.writes = this.writes.then(async () => {
      const json = JSON.stringify(this.state);
      if (Buffer.byteLength(json) > this.limits.maxStorageBytes) throw new Error('EDGE_STORAGE_CRITICAL');
      const temporary = `${this.path}.tmp`;
      const handle = await open(temporary, 'w', 0o600);
      try { await handle.writeFile(`${json}\n`, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await this.atomicReplace(temporary);
    });
    return this.writes;
  }

  private async atomicReplace(temporary: string) {
    for (let attempt = 0; ; attempt += 1) {
      try { await rename(temporary, this.path); return; }
      catch (error: any) {
        const transientWindowsLock = process.platform === 'win32' && ['EACCES', 'EBUSY', 'EPERM'].includes(error?.code);
        if (!transientWindowsLock || attempt >= 99) throw error;
        await delay(20);
      }
    }
  }
}
