import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateCropIrrigationRecipeDto {
  @ApiProperty({ description: '作物类型', example: '洋葱' })
  @IsString()
  cropType!: string;

  @ApiProperty({ description: '作物阶段', example: 'growing' })
  @IsString()
  cropStage!: string;

  @ApiPropertyOptional({ description: '土壤类型', example: 'loam' })
  @IsOptional()
  @IsString()
  soilType?: string;

  @ApiProperty({ description: '目标湿度下限', example: 38 })
  @IsNumber()
  targetMoistureMin!: number;

  @ApiProperty({ description: '目标湿度上限', example: 58 })
  @IsNumber()
  targetMoistureMax!: number;

  @ApiProperty({ description: '推荐灌溉分钟数', example: 30 })
  @IsNumber()
  @Min(0)
  recommendedIrrigationMinutes!: number;

  @ApiProperty({ description: '单日最大灌溉分钟数', example: 90 })
  @IsNumber()
  @Min(0)
  maxDailyIrrigationMinutes!: number;

  @ApiPropertyOptional({ description: '水肥建议', example: { nitrogen: 'low', advice: '苗期少量多次' } })
  @IsOptional()
  @IsObject()
  fertigationAdvice?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
