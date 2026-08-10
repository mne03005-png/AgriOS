import { createHash } from 'node:crypto';
import { PersistentEdgeStore } from './persistent-edge-store';
import { EdgeAckRecord, EdgeCommandRecord, EdgeTelemetryEnvelope, EdgeTelemetryQuality } from './edge-reliability.types';

export interface EdgeCloudTransport {
  connected(): boolean;
  uploadTelemetry(item: EdgeTelemetryEnvelope): Promise<void>;
  uploadAck(item: EdgeAckRecord): Promise<void>;
}

export class EdgeReliabilityAgent {
  private networkState: 'ONLINE' | 'OFFLINE' | 'DEGRADED' = 'OFFLINE';
  private queuePeakDepth = 0;
  private lastSeen = new Date().toISOString();

  constructor(private readonly store: PersistentEdgeStore, private readonly cloud: EdgeCloudTransport, private readonly scope: { tenantId: string; farmId: string; deviceIds: string[] }, private readonly options = { batchSize: 50, retryDelayMs: 100, maxBackoffMs: 30_000 }) {}

  async captureTelemetry(input: { messageId?: string; deviceId: string; tenantId: string; farmId: string; timestamp: string; sequence?: number; payload: Record<string, unknown> }) {
    this.assertScope(input);
    if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload) || Object.keys(input.payload).length === 0) throw new Error('EDGE_TELEMETRY_MALFORMED');
    const messageId = input.messageId ?? this.deriveMessageId(input.deviceId, input.sequence, input.timestamp);
    const quality = this.quality(input.deviceId, input.sequence, input.timestamp);
    const item: EdgeTelemetryEnvelope = { messageId, deviceId: input.deviceId, tenantId: input.tenantId, farmId: input.farmId, deviceTimestamp: input.timestamp, edgeReceivedAt: new Date().toISOString(), sequence: input.sequence, payload: input.payload, quality, priority: 'TELEMETRY', createdAt: new Date().toISOString(), attemptCount: 0, status: 'PENDING' };
    const result = await this.store.enqueueTelemetry(item);
    if (input.sequence !== undefined) await this.store.rememberSequence(input.deviceId, input.sequence);
    this.updatePeak(); this.lastSeen = item.edgeReceivedAt; return result;
  }

  async receiveCommand(input: { commandId: string; deviceId: string; tenantId: string; farmId: string; action: string; expiresAt: string; signatureValid: boolean }, execute: () => Promise<Record<string, unknown>>) {
    this.assertScope(input); if (!input.signatureValid) throw new Error('EDGE_COMMAND_INVALID_HMAC');
    const existing = this.store.command(input.commandId); if (existing) return { duplicate: true, record: existing };
    const dangerous = ['PUMP_ON', 'VALVE_OPEN'].includes(input.action);
    const expired = Date.parse(input.expiresAt) <= Date.now();
    const record: EdgeCommandRecord = { ...input, receivedAt: new Date().toISOString(), ackStatus: expired && dangerous ? 'EXPIRED' : 'PENDING' };
    if (expired && dangerous) record.result = { status: 'EXPIRED', executed: false };
    else { record.result = await execute(); record.executedAt = new Date().toISOString(); record.ackStatus = 'ACKNOWLEDGED'; }
    await this.store.saveCommand(record);
    await this.store.enqueueAck({ commandId: input.commandId, deviceId: input.deviceId, tenantId: input.tenantId, farmId: input.farmId, status: String(record.result?.status ?? record.ackStatus), feedback: record.result, timestamp: new Date().toISOString(), signatureMetadata: { algorithm: 'HMAC-SHA256' }, priority: input.action.includes('STOP') ? 'CRITICAL' : 'CONTROL', attemptCount: 0, queueStatus: 'PENDING' });
    this.updatePeak(); return { duplicate: false, record };
  }

  async replay() {
    if (!this.cloud.connected()) { this.networkState = 'OFFLINE'; return { uploaded: 0, pending: this.store.pendingDepth() }; }
    this.networkState = 'ONLINE'; let uploaded = 0;
    for (const item of this.store.nextBatch(this.options.batchSize)) {
      await this.store.markSending(item);
      try { if ('queueStatus' in item) await this.cloud.uploadAck(item); else await this.cloud.uploadTelemetry(item); await this.store.markUploaded(item); uploaded += 1; }
      catch { await this.store.markPending(item); this.networkState = 'DEGRADED'; break; }
    }
    return { uploaded, pending: this.store.pendingDepth() };
  }

  reconnectDelay(attempt: number, random = Math.random()) { const base = Math.min(this.options.maxBackoffMs, this.options.retryDelayMs * 2 ** Math.max(0, attempt)); return Math.round(base * (0.75 + random * 0.5)); }
  async health() {
    const usage = await this.store.storageUsage();
    return { online: this.cloud.connected(), lastSeen: this.lastSeen, queueDepth: this.store.pendingDepth(), queuePeakDepth: this.queuePeakDepth, oldestPendingAge: this.store.oldestPendingAge(), lastSuccessfulUpload: this.store.snapshot().lastSuccessfulUpload ?? null, lastCommandReceived: this.store.snapshot().lastCommandReceived ?? null, lastAckUploaded: this.store.snapshot().lastAckUploaded ?? null, networkState: this.networkState, storageUsage: usage, storageState: this.store.storageState(usage), softwareVersion: '0.1.0' };
  }

  private quality(deviceId: string, sequence: number | undefined, timestamp: string): EdgeTelemetryQuality {
    const time = Date.parse(timestamp); if (!Number.isFinite(time) || time - Date.now() > 5 * 60_000) return 'INVALID_TIMESTAMP';
    if (Date.now() - time > 24 * 60 * 60_000) return 'LATE';
    if (sequence === undefined) return 'MISSING_SEQUENCE';
    const last = this.store.sequence(deviceId); if (last !== undefined && sequence <= last) return sequence === last ? 'DUPLICATE' : 'OUT_OF_ORDER';
    return 'GOOD';
  }
  private deriveMessageId(deviceId: string, sequence: number | undefined, timestamp: string) { return createHash('sha256').update(`${deviceId}:${sequence ?? 'missing'}:${timestamp}`).digest('hex'); }
  private assertScope(input: { tenantId: string; farmId: string; deviceId: string }) { if (input.tenantId !== this.scope.tenantId) throw new Error('EDGE_TENANT_SCOPE_MISMATCH'); if (input.farmId !== this.scope.farmId) throw new Error('EDGE_FARM_SCOPE_MISMATCH'); if (!this.scope.deviceIds.includes(input.deviceId)) throw new Error('EDGE_DEVICE_SCOPE_MISMATCH'); }
  private updatePeak() { this.queuePeakDepth = Math.max(this.queuePeakDepth, this.store.pendingDepth()); }
}
