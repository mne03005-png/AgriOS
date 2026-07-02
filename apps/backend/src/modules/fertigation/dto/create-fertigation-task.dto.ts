import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFertigationTaskDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_onion_001' })
  @IsString()
  farmId!: string;

  @ApiPropertyOptional({ description: '地块 ID', example: 'field_onion_a' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '轮灌组 ID', example: 'rotation_group_001' })
  @IsOptional()
  @IsString()
  rotationGroupId?: string;

  @ApiPropertyOptional({ description: '肥料罐 ID', example: 'tank_001' })
  @IsOptional()
  @IsString()
  tankId?: string;

  @ApiPropertyOptional({ description: '水肥配方 ID', example: 'recipe_001' })
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiPropertyOptional({ description: '任务时长分钟', example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: '目标水量 L', example: 1200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetWaterVolume?: number;

  @ApiPropertyOptional({ description: '目标肥液量 L', example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetFertilizerVolume?: number;
}
