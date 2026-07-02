import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSafetyPolicyDto {
  @ApiProperty({ description: '策略名称', example: '洋葱地自动灌溉安全策略' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '农场 ID', example: 'farm_001' })
  @IsOptional()
  @IsString()
  farmId?: string;

  @ApiPropertyOptional({ description: '地块 ID', example: 'field_001' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '单次最大灌溉分钟数', example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxIrrigationMinutesPerAction?: number;

  @ApiPropertyOptional({ description: '单日最大灌溉分钟数', example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDailyIrrigationMinutesPerField?: number;

  @ApiPropertyOptional({ description: '单日最大用水量', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDailyWaterUsage?: number;

  @ApiPropertyOptional({ description: '是否允许自动执行', example: false })
  @IsOptional()
  @IsBoolean()
  allowAutoExecution?: boolean;

  @ApiPropertyOptional({ description: '需要审批的风险级别', example: 'HIGH' })
  @IsOptional()
  @IsString()
  requireApprovalRiskLevel?: string;

  @ApiPropertyOptional({ description: '是否开启急停', example: false })
  @IsOptional()
  @IsBoolean()
  emergencyStopEnabled?: boolean;
}
