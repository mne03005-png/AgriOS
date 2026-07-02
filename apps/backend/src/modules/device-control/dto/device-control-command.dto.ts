import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export const DEVICE_CONTROL_COMMANDS = [
  'PUMP_ON',
  'PUMP_OFF',
  'VALVE_OPEN',
  'VALVE_CLOSE',
  'TEST_OPEN_VALVE',
  'SET_VALVE_OPENING',
  'SET_PUMP_FREQUENCY',
  'START_FERTIGATION',
  'STOP_FERTIGATION',
  'START_DISSOLVING',
  'STOP_DISSOLVING',
  'EMERGENCY_STOP'
] as const;

export const DEVICE_CONTROL_ADAPTERS = ['mock', 'mqtt', 'thingsboard', 'edge', 'plc', 'bluetooth', 'MOCK', 'MQTT_DIRECT', 'THINGSBOARD_CLOUD', 'EDGE_HTTP', 'PLC_GATEWAY', 'BLUETOOTH_LOCAL'] as const;

export type DeviceControlCommand = (typeof DEVICE_CONTROL_COMMANDS)[number];
export type DeviceControlAdapter = (typeof DEVICE_CONTROL_ADAPTERS)[number];

export class DeviceControlCommandDto {
  @ApiProperty({ description: '设备控制命令', enum: DEVICE_CONTROL_COMMANDS, example: 'PUMP_ON' })
  @IsIn(DEVICE_CONTROL_COMMANDS)
  command!: DeviceControlCommand;

  @ApiPropertyOptional({ description: '控制通道', enum: DEVICE_CONTROL_ADAPTERS, example: 'mock' })
  @IsOptional()
  @IsIn(DEVICE_CONTROL_ADAPTERS)
  adapter?: DeviceControlAdapter;

  @ApiPropertyOptional({ description: '操作备注', example: '人工确认后执行' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '控制载荷', example: { durationMinutes: 30, openingPercent: 80 } })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
