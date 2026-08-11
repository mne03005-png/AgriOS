import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { EdgeAckRecord, EdgeTelemetryEnvelope } from '@agrios/edge-core';
import { RuntimeMqttTransport } from './mqtt-transport';

type CloudState = { telemetry: Record<string, EdgeTelemetryEnvelope>; acks: Record<string, EdgeAckRecord>; order: string[]; health?: Record<string, unknown> };
export class FakeMqttTransport implements RuntimeMqttTransport {
  private online = false; private handler: (payload: string) => Promise<void> = async () => undefined;
  constructor(private readonly path: string, private readonly requestedOnline: boolean, private readonly latencyMs = 0, private readonly failurePercent = 0) {}
  connected() { return this.online; }
  onCommand(handler: (payload: string) => Promise<void>) { this.handler = handler; }
  async connect() { this.online = this.requestedOnline; }
  async disconnect() { this.online = false; }
  async uploadTelemetry(item: EdgeTelemetryEnvelope) { await this.network(item.attemptCount); await this.update((state) => { state.telemetry[item.messageId] = item; state.order.push(`telemetry:${item.messageId}`); }); }
  async uploadAck(item: EdgeAckRecord) { await this.network(item.attemptCount); await this.update((state) => { state.acks[`${item.commandId}:${item.status}`] = item; state.order.push(`ack:${item.commandId}`); }); }
  async publishHealth(health: Record<string, unknown>) { if (this.online) await this.update((state) => { state.health = health; }); }
  async injectCommand(value: unknown) { await this.handler(JSON.stringify(value)); }
  private async network(attempt: number) { if (!this.online) throw new Error('FAKE_MQTT_OFFLINE'); if (this.latencyMs) await new Promise((resolve) => setTimeout(resolve, this.latencyMs)); if (this.failurePercent && attempt % 100 < this.failurePercent) throw new Error('FAKE_MQTT_FAILURE'); }
  private async update(change: (state: CloudState) => void) { await mkdir(dirname(this.path), { recursive: true }); let state: CloudState = { telemetry: {}, acks: {}, order: [] }; try { state = JSON.parse(await readFile(this.path, 'utf8')); state.order ??= []; } catch {} change(state); const temporary = `${this.path}.tmp`; await writeFile(temporary, `${JSON.stringify(state)}\n`); await rename(temporary, this.path); }
}
