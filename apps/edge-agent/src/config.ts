import { readFile } from 'node:fs/promises';

export interface EdgeConfig {
  edgeId: string; tenantId: string; farmId: string; allowedDeviceIds: string[]; softwareVersion: string; configVersion: string;
  mqtt: { host: string; port: number; tls: boolean; clientId: string; caPath?: string; certPath?: string; keyPath?: string; hmacKeyPath: string; telemetryTopic: string; commandsTopic: string; acksTopic: string; healthTopic: string };
  storage: { path: string; maxQueueSize: number; maxStorageBytes: number; retentionMs: number };
  reconnect: { initialDelayMs: number; maxDelayMs: number; jitter: number };
  plc: { transport: 'FAKE' | 'MODBUS_TCP'; host?: string; port?: number; profilePath?: string; realProfileApproved?: boolean };
  safety: { realWriteEnabled: boolean; feedbackTimeoutMs: number; feedbackPollIntervalMs: number };
  healthIntervalMs: number;
}

export async function loadConfig(path: string): Promise<EdgeConfig> {
  let value: any;
  try { value = JSON.parse(await readFile(path, 'utf8')); } catch (error) { throw new Error(`EDGE_CONFIG_INVALID_JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const missing = ['edgeId', 'tenantId', 'farmId'].filter((key) => !text(value[key]));
  if (!Array.isArray(value.allowedDeviceIds) || !value.allowedDeviceIds.length || value.allowedDeviceIds.some((item: unknown) => !text(item))) missing.push('allowedDeviceIds');
  if (!text(value.mqtt?.host) || !integer(value.mqtt?.port, 1, 65535)) missing.push('mqtt.endpoint');
  if (!text(value.mqtt?.clientId) || !text(value.mqtt?.hmacKeyPath)) missing.push('mqtt.machineCredential');
  if (!text(value.storage?.path)) missing.push('storage.path');
  if (missing.length) throw new Error(`EDGE_CONFIG_MISSING: ${missing.join(',')}`);
  const config: EdgeConfig = {
    edgeId: value.edgeId, tenantId: value.tenantId, farmId: value.farmId, allowedDeviceIds: value.allowedDeviceIds,
    softwareVersion: text(value.softwareVersion) ? value.softwareVersion : '0.1.0', configVersion: text(value.configVersion) ? value.configVersion : '1',
    mqtt: { host: value.mqtt.host, port: value.mqtt.port, tls: value.mqtt.tls !== false, clientId: value.mqtt.clientId, caPath: optional(value.mqtt.caPath), certPath: optional(value.mqtt.certPath), keyPath: optional(value.mqtt.keyPath), hmacKeyPath: value.mqtt.hmacKeyPath,
      telemetryTopic: value.mqtt.telemetryTopic ?? 'agrios/device/{deviceId}/telemetry', commandsTopic: value.mqtt.commandsTopic ?? 'agrios/device/+/command', acksTopic: value.mqtt.acksTopic ?? 'agrios/device/{deviceId}/ack', healthTopic: value.mqtt.healthTopic ?? `agrios/edge/${value.edgeId}/status` },
    storage: { path: value.storage.path, maxQueueSize: positive(value.storage.maxQueueSize, 10_000), maxStorageBytes: positive(value.storage.maxStorageBytes, 64 * 1024 * 1024), retentionMs: positive(value.storage.retentionMs, 30 * 24 * 60 * 60_000) },
    reconnect: { initialDelayMs: positive(value.reconnect?.initialDelayMs, 1_000), maxDelayMs: positive(value.reconnect?.maxDelayMs, 30_000), jitter: finite(value.reconnect?.jitter, 0.25) },
    plc: { transport: value.plc?.transport === 'MODBUS_TCP' ? 'MODBUS_TCP' : 'FAKE', host: optional(value.plc?.host), port: integer(value.plc?.port, 1, 65535) ? value.plc.port : undefined, profilePath: optional(value.plc?.profilePath), realProfileApproved: value.plc?.realProfileApproved === true },
    safety: { realWriteEnabled: value.safety?.realWriteEnabled === true, feedbackTimeoutMs: boundedInteger(value.safety?.feedbackTimeoutMs, 2_000, 1, 60_000), feedbackPollIntervalMs: boundedInteger(value.safety?.feedbackPollIntervalMs, 100, 1, 60_000) }, healthIntervalMs: positive(value.healthIntervalMs, 30_000)
  };
  return config;
}

export function realWriteEligible(config: EdgeConfig, env: NodeJS.ProcessEnv = process.env) {
  return config.safety.realWriteEnabled && config.plc.transport === 'MODBUS_TCP' && config.plc.realProfileApproved === true && Boolean(config.plc.profilePath)
    && env.DEVICE_CONTROL_MODE === 'PLC_GATEWAY' && env.DEVICE_CONTROL_DRY_RUN === 'false' && env.VALVE_ALLOW_REAL_CONTROL === 'true'
    && env.ENABLE_AUTO_EXECUTION === 'true' && env.PLC_TRANSPORT === 'MODBUS_TCP' && env.PLC_REAL_WRITE_ENABLED === 'true';
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const optional = (value: unknown) => text(value) ? value : undefined;
const positive = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value: unknown, min: number, max: number) => Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
const boundedInteger = (value: unknown, fallback: number, min: number, max: number) => value === undefined ? fallback : integer(value, min, max) ? Number(value) : (() => { throw new Error('EDGE_CONFIG_INVALID_BOUNDED_INTEGER'); })();
