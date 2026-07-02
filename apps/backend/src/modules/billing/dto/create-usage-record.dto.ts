import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateUsageRecordDto {
  @ApiProperty({ description: '租户 ID', example: 'tenant_onion_coop' })
  @IsString()
  tenantId!: string;

  @ApiProperty({
    description: '用量类型',
    enum: ['DEVICE_ONLINE', 'AI_DECISION', 'IRRIGATION_ACTION', 'WATER_USAGE', 'SMS_ALERT', 'MAP_RECOGNITION', 'DRONE_OPERATION', 'DRONE_OPERATION_REPORT', 'DRONE_JOB', 'DEVICE_EXECUTION', 'DEVICE_ONLINE_DAY', 'HECTARE_MONTH'],
    example: 'AI_DECISION'
  })
  @IsIn(['DEVICE_ONLINE', 'AI_DECISION', 'IRRIGATION_ACTION', 'WATER_USAGE', 'SMS_ALERT', 'MAP_RECOGNITION', 'DRONE_OPERATION', 'DRONE_OPERATION_REPORT', 'DRONE_JOB', 'DEVICE_EXECUTION', 'DEVICE_ONLINE_DAY', 'HECTARE_MONTH'])
  type!: string;

  @ApiProperty({ description: '用量数量', example: 1 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ description: '农场 ID', example: 'farm_001' })
  @IsOptional()
  @IsString()
  farmId?: string;

  @ApiPropertyOptional({ description: '地块 ID', example: 'field_001' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '设备 ID', example: 'device_001' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: '计费金额', example: 0.12 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: '计量单位', example: '次' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: '关联对象类型', example: 'DecisionRecord' })
  @IsOptional()
  @IsString()
  refType?: string;

  @ApiPropertyOptional({ description: '关联对象 ID', example: 'decision_001' })
  @IsOptional()
  @IsString()
  refId?: string;
}
