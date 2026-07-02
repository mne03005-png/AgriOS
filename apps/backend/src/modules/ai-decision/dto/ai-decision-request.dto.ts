import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AiDecisionRequestDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '地块 ID', example: 'field_001' })
  @IsString()
  fieldId!: string;

  @ApiPropertyOptional({ description: '作物类型', example: '洋葱' })
  @IsOptional()
  @IsString()
  cropType?: string;
}
