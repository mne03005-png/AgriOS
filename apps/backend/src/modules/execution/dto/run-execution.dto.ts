import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RunExecutionDto {
  @ApiProperty({ description: '执行模式', enum: ['MANUAL', 'ASSISTED', 'AUTO'], example: 'ASSISTED' })
  @IsIn(['MANUAL', 'ASSISTED', 'AUTO'])
  mode!: 'MANUAL' | 'ASSISTED' | 'AUTO';

  @ApiProperty({ description: '地块 ID', example: 'field_001' })
  @IsString()
  fieldId!: string;

  @ApiProperty({ description: '设备 ID', example: 'device_001' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ description: '设备指令', enum: ['PUMP_ON', 'PUMP_OFF', 'VALVE_OPEN', 'VALVE_CLOSE'], example: 'PUMP_ON' })
  @IsIn(['PUMP_ON', 'PUMP_OFF', 'VALVE_OPEN', 'VALVE_CLOSE'])
  command!: 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE';

  @ApiPropertyOptional({ description: '计划灌溉分钟数', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: '计划用水量', example: 1200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedWaterAmount?: number;

  @ApiPropertyOptional({ description: '土壤湿度', example: 32 })
  @IsOptional()
  @IsNumber()
  soilMoisture?: number;
}
