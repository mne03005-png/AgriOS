export interface PlcTransportOptions {
  host: string;
  port: number;
  unitId: number;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
  retry: number;
}

export interface PlcTransportHealth {
  connected: boolean;
  transport: string;
  error?: string;
}

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
