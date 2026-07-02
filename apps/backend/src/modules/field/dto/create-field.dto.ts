import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateFieldDto {
  @ApiProperty()
  @Allow()
  farmId!: string;

  @ApiProperty()
  @Allow()
  name!: string;

  @ApiProperty()
  @Allow()
  areaMu!: number;

  @ApiPropertyOptional()
  @Allow()
  location?: string;

  @Allow()
  latitude?: number;

  @Allow()
  longitude?: number;

  @Allow()
  soilType?: string;

  @Allow()
  waterSource?: string;

  @Allow()
  irrigationMethod?: string;

  @ApiPropertyOptional({ enum: ['SELF', 'LEASED', 'CONTRACTED'] })
  @Allow()
  landSource?: 'SELF' | 'LEASED' | 'CONTRACTED';

  @ApiPropertyOptional()
  @Allow()
  lastYearCrop?: string;

  @ApiPropertyOptional()
  @Allow()
  currentSuggestion?: string;

  @Allow()
  remark?: string;
}
