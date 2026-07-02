import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAnomalyRuleDto {
  @ApiProperty({ description: '规则名称', example: '洋葱地主管压力过低' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '异常类型', enum: ['PRESSURE_DROP', 'PRESSURE_TOO_HIGH', 'FLOW_TOO_LOW', 'FLOW_TOO_HIGH', 'VALVE_NOT_RESPONDING', 'PUMP_ABNORMAL', 'TANK_LOW_LEVEL'], example: 'PRESSURE_DROP' })
  @IsIn(['PRESSURE_DROP', 'PRESSURE_TOO_HIGH', 'FLOW_TOO_LOW', 'FLOW_TOO_HIGH', 'VALVE_NOT_RESPONDING', 'PUMP_ABNORMAL', 'TANK_LOW_LEVEL'])
  type!: string;

  @ApiProperty({ description: '阈值 JSON', example: { min: 120, severity: 'HIGH' } })
  @IsObject()
  thresholdJson!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '农场 ID', example: 'farm_onion_001' })
  @IsOptional()
  @IsString()
  farmId?: string;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
