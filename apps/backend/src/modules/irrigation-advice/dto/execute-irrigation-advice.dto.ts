import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ExecuteIrrigationAdviceDto {
  @ApiProperty({ description: '水泵设备ID', example: 'clx-pump-device-id' })
  @Allow()
  pumpDeviceId!: string;

  @ApiPropertyOptional({ description: '阀门设备ID', example: 'clx-valve-device-id' })
  @Allow()
  valveDeviceId?: string;

  @ApiProperty({ description: '下发指令', enum: ['PUMP_ON', 'PUMP_OFF', 'VALVE_OPEN', 'VALVE_CLOSE'], example: 'PUMP_ON' })
  @Allow()
  command!: 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE';

  @ApiPropertyOptional({ description: '执行备注', example: '人工确认后执行灌溉' })
  @Allow()
  remark?: string;
}
