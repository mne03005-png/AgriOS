// OpenAgriOS v0.1-alpha telemetry contract. See docs/mqtt-spec.md for the full spec.
//
// This is deliberately separate from src/modules/mqtt/mqtt-topics.ts (AGRIOS_MQTT_TOPICS),
// which carries the production device-command/ack path gated by DEVICE_CONTROL_MODE. The alpha
// topic below is read-only telemetry on its own versioned namespace and is never used to send a
// command to a device.
export const OPEN_AGRIOS_MQTT_TOPIC_WILDCARD = 'agrios/v1/farm/+/device/+/telemetry';

export function openAgriosTelemetryTopic(farmId: string, deviceId: string) {
  return `agrios/v1/farm/${farmId}/device/${deviceId}/telemetry`;
}

export const OPEN_AGRIOS_TELEMETRY_TOPIC_PATTERN = /^agrios\/v1\/farm\/([^/]+)\/device\/([^/]+)\/telemetry$/;

export type OpenAgriosTelemetryPayload = {
  deviceId: string;
  fieldId?: string;
  timestamp?: string;
  status?: 'online' | 'offline';
  data: {
    soilMoisture?: number;
    temperature?: number;
    humidity?: number;
    battery?: number;
  };
};

// Simple, fixed alpha thresholds -- intentionally not configurable per-crop/per-field. This is a
// demo-grade alert, not the production decision engine.
export const LOW_SOIL_MOISTURE_THRESHOLD = 20;
export const LOW_BATTERY_THRESHOLD = 15;
export const DEVICE_OFFLINE_AFTER_MS = 30_000;
