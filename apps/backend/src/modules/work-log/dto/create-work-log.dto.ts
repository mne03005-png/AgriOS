import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateWorkLogDto {
  @ApiProperty()
  @Allow()
  fieldId!: string;

  @ApiProperty()
  @Allow()
  cropSeasonId!: string;

  @ApiProperty({ enum: ['SOWING', 'WATERING', 'FERTILIZING', 'PESTICIDE', 'WEEDING', 'TILLAGE', 'MULCHING', 'DRONE', 'MACHINERY', 'LABOR', 'HARVEST', 'OTHER'] })
  @Allow()
  type!: 'SOWING' | 'WATERING' | 'FERTILIZING' | 'PESTICIDE' | 'WEEDING' | 'TILLAGE' | 'MULCHING' | 'DRONE' | 'MACHINERY' | 'LABOR' | 'HARVEST' | 'OTHER';

  @ApiProperty()
  @Allow()
  workDate!: string;

  @ApiPropertyOptional()
  @Allow()
  workerName?: string;

  @Allow()
  farmInputIds?: string[];

  @Allow()
  areaMu?: number;

  @Allow()
  laborHours?: number;

  @ApiPropertyOptional()
  @Allow()
  cost?: number;

  @Allow()
  imageUrls?: string[];

  @Allow()
  remark?: string;
}
