import { readFile } from 'node:fs/promises';
import mqtt, { MqttClient } from 'mqtt';
import { EdgeAckRecord, EdgeCloudTransport, EdgeTelemetryEnvelope } from '@agrios/edge-core';
import { EdgeConfig } from './config';
import { EDGE_TOPICS } from './topics';

export interface RuntimeMqttTransport extends EdgeCloudTransport {
  connect(): Promise<void>; disconnect(): Promise<void>; publishHealth(health: Record<string, unknown>): Promise<void>;
  onCommand(handler: (payload: string) => Promise<void>): void;
}

export class EdgeMqttTransport implements RuntimeMqttTransport {
  private client?: MqttClient;
  private online = false;
  private reconnectAttempt = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private stopping = false;
  private commandHandler: (payload: string) => Promise<void> = async () => undefined;
  constructor(private readonly config: EdgeConfig) {}
  connected() { return this.online; }
  onCommand(handler: (payload: string) => Promise<void>) { this.commandHandler = handler; }
  async connect() {
    if (this.online || this.stopping) return;
    const options: Record<string, unknown> = { clientId: this.config.mqtt.clientId, qos: 1, reconnectPeriod: 0, clean: false };
    for (const [key, path] of [['ca', this.config.mqtt.caPath], ['cert', this.config.mqtt.certPath], ['key', this.config.mqtt.keyPath]] as const) if (path) options[key] = await readFile(path);
    const protocol = this.config.mqtt.tls ? 'mqtts' : 'mqtt';
    this.client = mqtt.connect(`${protocol}://${this.config.mqtt.host}:${this.config.mqtt.port}`, options);
    await new Promise<void>((resolve, reject) => { this.client?.once('connect', () => resolve()); this.client?.once('error', reject); });
    this.online = true; this.reconnectAttempt = 0; this.client.on('close', () => { this.online = false; this.scheduleReconnect(); });
    this.client.on('message', (_topic, payload) => { void this.commandHandler(payload.toString()); });
    await this.subscribe(this.config.mqtt.commandsTopic || EDGE_TOPICS.commandWildcard);
  }
  async disconnect() { this.stopping = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); if (this.client) await new Promise<void>((resolve, reject) => this.client?.end(false, {}, (error) => error ? reject(error) : resolve())); this.online = false; }
  uploadTelemetry(item: EdgeTelemetryEnvelope) { return this.publish(this.config.mqtt.telemetryTopic.replace('{deviceId}', item.deviceId), item); }
  uploadAck(item: EdgeAckRecord) { return this.publish(this.config.mqtt.acksTopic.replace('{deviceId}', item.deviceId), item); }
  publishHealth(health: Record<string, unknown>) { return this.publish(this.config.mqtt.healthTopic || EDGE_TOPICS.edgeHealth(this.config.edgeId), health); }
  private publish(topic: string, value: unknown) { return new Promise<void>((resolve, reject) => this.client?.publish(topic, JSON.stringify(value), { qos: 1 }, (error) => error ? reject(error) : resolve())); }
  private subscribe(topic: string) { return new Promise<void>((resolve, reject) => this.client?.subscribe(topic, { qos: 1 }, (error) => error ? reject(error) : resolve())); }
  private scheduleReconnect() {
    if (this.stopping || this.reconnectTimer) return;
    const base = Math.min(this.config.reconnect.maxDelayMs, this.config.reconnect.initialDelayMs * 2 ** this.reconnectAttempt++);
    const spread = base * this.config.reconnect.jitter; const delay = Math.max(1, Math.round(base - spread + Math.random() * spread * 2));
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; void this.connect().catch(() => this.scheduleReconnect()); }, delay);
  }
}
