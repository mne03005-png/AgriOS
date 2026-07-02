import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateCropSeasonDto {
  @ApiProperty()
  @Allow()
  fieldId!: string;

  @ApiProperty()
  @Allow()
  cropName!: string;

  @ApiPropertyOptional()
  @Allow()
  variety?: string;

  @ApiProperty()
  @Allow()
  year!: number;

  @ApiPropertyOptional()
  @Allow()
  season?: string;

  @Allow()
  sowingDate?: string;

  @Allow()
  expectedHarvestDate?: string;

  @Allow()
  actualHarvestDate?: string;

  @Allow()
  managerName?: string;

  @ApiProperty({ enum: ['PLANNED', 'GROWING', 'HARVESTED', 'CLOSED'] })
  @Allow()
  status!: 'PLANNED' | 'GROWING' | 'HARVESTED' | 'CLOSED';

  @Allow()
  remark?: string;
}
