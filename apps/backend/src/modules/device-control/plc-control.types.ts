export type PlcControlAction =
  | 'VALVE_OPEN' | 'VALVE_CLOSE' | 'PUMP_ON' | 'PUMP_OFF'
  | 'IRRIGATION_START' | 'IRRIGATION_STOP' | 'EMERGENCY_STOP' | 'RESET';

export type PlcCommandStatus =
  | 'CREATED' | 'QUEUED' | 'DISPATCHING' | 'SENT' | 'ACK_PENDING'
  | 'ACKNOWLEDGED' | 'SUCCEEDED' | 'REJECTED' | 'TIMEOUT' | 'FAILED'
  | 'CANCELLED' | 'EXPIRED' | 'SAFETY_BLOCKED';

export interface PlcControlCommand {
  commandId: string;
  tenantId: string;
  farmId: string;
  fieldId?: string;
  zoneId?: string;
  deviceId: string;
  action: PlcControlAction;
  requestedAt: string;
  expiresAt: string;
  idempotencyKey: string;
  parameters: Record<string, unknown>;
}

export interface PlcCommandResult {
  commandId: string;
  accepted: boolean;
  executed: boolean;
  acknowledged: boolean;
  status: PlcCommandStatus;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  feedback?: Record<string, unknown>;
}

export interface PlcFeedback {
  commandId: string;
  tenantId: string;
  farmId: string;
  deviceId: string;
  status: 'ACKNOWLEDGED' | 'SUCCEEDED' | 'FAILED';
  timestamp: string;
  feedback?: Record<string, unknown>;
  errorCode?: string;
}

export interface PlcStatus {
  online: boolean;
  emergencyStop: boolean;
  noWater: boolean;
  overloadTrip: boolean;
  pumpRunning: boolean;
  valveOpen: boolean;
}

export interface PlcControllerPort {
  execute(command: PlcControlCommand): Promise<PlcCommandResult>;
  emergencyStop(command: PlcControlCommand): Promise<PlcCommandResult>;
  readStatus(deviceId: string): Promise<PlcStatus>;
  verifyFeedback(command: PlcControlCommand, feedback: PlcFeedback): Promise<PlcCommandResult>;
  healthCheck(): Promise<{ healthy: boolean; reason?: string }>;
}
