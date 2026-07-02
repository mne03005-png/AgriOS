import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateCostDto {
  @ApiProperty()
  @Allow()
  cropSeasonId!: string;

  @ApiProperty({ enum: ['SEED', 'FERTILIZER', 'PESTICIDE', 'LABOR', 'DRONE', 'MACHINERY', 'IRRIGATION', 'ELECTRICITY', 'RENT', 'OTHER'] })
  @Allow()
  type!: 'SEED' | 'FERTILIZER' | 'PESTICIDE' | 'LABOR' | 'DRONE' | 'MACHINERY' | 'IRRIGATION' | 'ELECTRICITY' | 'RENT' | 'OTHER';

  @ApiProperty()
  @Allow()
  amount!: number;

  @ApiProperty()
  @Allow()
  occurredDate!: string;

  @ApiPropertyOptional()
  @Allow()
  sourceRecordId?: string;

  @ApiPropertyOptional({ description: '来源类型', example: 'FARM_INPUT' })
  @Allow()
  sourceType?: string;

  @ApiPropertyOptional({ description: '来源记录ID', example: 'clx-farm-input-id' })
  @Allow()
  sourceId?: string;

  @Allow()
  remark?: string;
}
