export class DeviceCommandDto {
  deviceId!: string;
  command!: 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE';
  requestId?: string;
  payload?: Record<string, unknown>;
}
