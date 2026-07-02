export const MQTT_TOPICS = {
  telemetry: (deviceId: string) => `agrios/device/${deviceId}/telemetry`,
  status: (deviceId: string) => `agrios/device/${deviceId}/status`,
  command: (deviceId: string) => `agrios/device/${deviceId}/command`,
  ackWildcard: 'agrios/device/+/ack',
  telemetryWildcard: 'agrios/device/+/telemetry',
  statusWildcard: 'agrios/device/+/status'
} as const;
