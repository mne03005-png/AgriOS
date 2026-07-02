import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CheckSafetyDto {
  @ApiProperty({ description: '地块 ID', example: 'field_001' })
  @IsString()
  fieldId!: string;

  @ApiPropertyOptional({ description: '计划用水量', example: 1200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedWaterAmount?: number;

  @ApiPropertyOptional({ description: '计划灌溉时长分钟', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: '土壤湿度', example: 32 })
  @IsOptional()
  @IsNumber()
  soilMoisture?: number;
}
