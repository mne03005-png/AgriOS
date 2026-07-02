import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateFertigationRecipeDto {
  @ApiProperty({ description: '配方名称', example: '洋葱膨大期水肥配方' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '配方 JSON', example: { fertilizerKgPerMu: 8, dilutionRatio: 300, notes: '低压慢灌' } })
  @IsObject()
  recipeJson!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '农场 ID', example: 'farm_onion_001' })
  @IsOptional()
  @IsString()
  farmId?: string;

  @ApiPropertyOptional({ description: '作物类型', example: '洋葱' })
  @IsOptional()
  @IsString()
  cropType?: string;

  @ApiPropertyOptional({ description: '作物阶段', example: 'bulbing' })
  @IsOptional()
  @IsString()
  cropStage?: string;

  @ApiPropertyOptional({ description: '建议时长分钟', example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  recommendedDurationMinutes?: number;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
