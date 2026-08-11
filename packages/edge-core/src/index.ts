export * from './edge-reliability-agent';
export * from './edge-reliability.types';
export * from './persistent-edge-store';
export * from './modbus-tcp.transport';

export const AGRIOS_MQTT_TOPICS = {
  telemetry: (deviceId: string) => `agrios/device/${deviceId}/telemetry`,
  status: (deviceId: string) => `agrios/device/${deviceId}/status`,
  command: (deviceId: string) => `agrios/device/${deviceId}/command`,
  ack: (deviceId: string) => `agrios/device/${deviceId}/ack`,
  commandWildcard: 'agrios/device/+/command',
  ackWildcard: 'agrios/device/+/ack',
  telemetryWildcard: 'agrios/device/+/telemetry',
  statusWildcard: 'agrios/device/+/status',
  edgeHealth: (edgeId: string) => `agrios/edge/${edgeId}/status`
} as const;

export interface PlcTransportHealth { connected: boolean; transport: string; error?: string }
export interface PlcTransportPort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<PlcTransportHealth>;
  readCoil(address: number): Promise<boolean>;
  writeCoil(address: number, value: boolean): Promise<void>;
  readDiscreteInput(address: number): Promise<boolean>;
  readHoldingRegister(address: number): Promise<number>;
  writeHoldingRegister(address: number, value: number): Promise<void>;
  readInputRegister(address: number): Promise<number>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
