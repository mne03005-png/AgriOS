export const DEVICE_CONTROL_MODES = [
  'MOCK',
  'THINGSBOARD_CLOUD',
  'MQTT_DIRECT',
  'EDGE_HTTP',
  'PLC_GATEWAY',
  'BLUETOOTH_LOCAL'
] as const;

export type DeviceControlMode = (typeof DEVICE_CONTROL_MODES)[number];

export function normalizeDeviceControlMode(value?: string): DeviceControlMode {
  const normalized = (value ?? 'MOCK').toUpperCase();
  if (normalized === 'THINGSBOARD') return 'THINGSBOARD_CLOUD';
  if (normalized === 'MQTT') return 'MQTT_DIRECT';
  return DEVICE_CONTROL_MODES.includes(normalized as DeviceControlMode) ? (normalized as DeviceControlMode) : 'MOCK';
}
