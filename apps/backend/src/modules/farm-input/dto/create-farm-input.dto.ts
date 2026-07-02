import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateFarmInputDto {
  @ApiProperty()
  @Allow()
  cropSeasonId!: string;

  @ApiProperty({ enum: ['SEED', 'FERTILIZER', 'PESTICIDE', 'FILM', 'IRRIGATION_MATERIAL', 'OTHER'] })
  @Allow()
  type!: 'SEED' | 'FERTILIZER' | 'PESTICIDE' | 'FILM' | 'IRRIGATION_MATERIAL' | 'OTHER';

  @ApiProperty()
  @Allow()
  name!: string;

  @Allow()
  brand?: string;

  @Allow()
  specification?: string;

  @Allow()
  purchaseChannel?: string;

  @Allow()
  supplierName?: string;

  @ApiProperty()
  @Allow()
  quantity!: number;

  @ApiPropertyOptional()
  @Allow()
  unitPrice?: number;

  @ApiPropertyOptional()
  @Allow()
  totalPrice?: number;

  @Allow()
  purchaseDate?: string;

  @Allow()
  usedDate?: string;

  @Allow()
  remark?: string;
}
