import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateRotationGroupDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_onion_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '轮灌组名称', example: '洋葱地 A 东区轮灌组' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '地块 ID', example: 'field_onion_a' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '灌溉设计 ID', example: 'design_001' })
  @IsOptional()
  @IsString()
  irrigationDesignId?: string;

  @ApiPropertyOptional({ description: '目标压力 kPa', example: 180 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetPressureKpa?: number;

  @ApiPropertyOptional({ description: '目标流量 m3/h', example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetFlowRate?: number;

  @ApiPropertyOptional({ description: '扩展信息', example: { note: '先东后西' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
