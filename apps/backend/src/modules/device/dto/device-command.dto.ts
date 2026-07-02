import { Allow } from 'class-validator';

export class DeviceCommandDto {
  @Allow()
  command!: 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE';
}
