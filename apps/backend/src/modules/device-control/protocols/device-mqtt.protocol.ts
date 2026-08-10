export interface DeviceTelemetryMessage {
  messageId: string;
  deviceId: string;
  timestamp: string;
  sequence: number;
  soilMoisture?: number;
  pressure?: number;
  flowRate?: number;
  pumpRunning?: boolean;
  pumpFrequency?: number;
  valveOpen?: boolean;
  valvePosition?: number;
  battery?: number;
  SOC?: number;
  RSSI?: number;
  SNR?: number;
}

export interface DeviceCommandMessage {
  commandId: string;
  deviceId: string;
  action: string;
  parameters: Record<string, unknown>;
  issuedAt: string;
  expiresAt: string;
}

export interface DeviceAckMessage {
  commandId: string;
  deviceId: string;
  status: string;
  timestamp: string;
  feedback?: Record<string, unknown>;
  errorCode?: string;
  signature?: string;
}
