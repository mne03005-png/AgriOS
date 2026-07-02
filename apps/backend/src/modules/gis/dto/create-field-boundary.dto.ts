import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateFieldBoundaryDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiPropertyOptional({ description: '关联地块 ID', example: 'field_001' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiProperty({ description: '边界名称', example: '洋葱地A边界候选' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '边界来源', enum: ['MANUAL_DRAW', 'HANDHELD_GPS', 'DRONE_FLIGHT', 'DRONE_ORTHOMOSAIC', 'GOOGLE_MAP', 'AMAP', 'BAIDU_MAP', 'AI_RECOGNITION'], example: 'MANUAL_DRAW' })
  @IsIn(['MANUAL_DRAW', 'HANDHELD_GPS', 'DRONE_FLIGHT', 'DRONE_ORTHOMOSAIC', 'GOOGLE_MAP', 'AMAP', 'BAIDU_MAP', 'AI_RECOGNITION'])
  source!: string;

  @ApiProperty({ description: '输入坐标系', enum: ['WGS84', 'GCJ02', 'BD09'], example: 'GCJ02' })
  @IsIn(['WGS84', 'GCJ02', 'BD09'])
  coordinateSystem!: string;

  @ApiProperty({ description: 'GeoJSON Polygon 或 Feature<Polygon>', example: { type: 'Polygon', coordinates: [[[118.1, 36.7], [118.2, 36.7], [118.2, 36.8], [118.1, 36.8], [118.1, 36.7]]] } })
  @IsObject()
  polygon!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '识别置信度', example: 0.86 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
