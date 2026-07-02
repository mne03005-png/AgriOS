import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RunWettingSimulationDto {
  @ApiProperty({ description: '地块 ID', example: 'field_001' })
  @IsString()
  fieldId!: string;

  @ApiPropertyOptional({ description: '灌溉设计 ID', example: 'design_001' })
  @IsOptional()
  @IsString()
  designId?: string;

  @ApiProperty({ description: '作物类型', example: '洋葱' })
  @IsString()
  cropType!: string;

  @ApiProperty({ description: '土壤类型：sandy / loam / clay', example: 'loam' })
  @IsString()
  soilType!: string;

  @ApiProperty({ description: '滴头流量，L/h', example: 1.6 })
  @IsNumber()
  @Min(0)
  emitterFlowRate!: number;

  @ApiProperty({ description: '灌溉分钟数', example: 30 })
  @IsNumber()
  @Min(0)
  irrigationMinutes!: number;
}
