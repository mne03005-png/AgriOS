import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateMapLayerDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '图层名称', example: '洋葱地A边界图层' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '图层类型', enum: ['FIELD', 'OBSTACLE', 'WATER', 'ROAD', 'PIPELINE', 'DEVICE', 'DRONE_ROUTE', 'IRRIGATION_ZONE'], example: 'FIELD' })
  @IsIn(['FIELD', 'OBSTACLE', 'WATER', 'ROAD', 'PIPELINE', 'DEVICE', 'DRONE_ROUTE', 'IRRIGATION_ZONE'])
  type!: string;

  @ApiProperty({ description: '图层来源', example: 'FIELD_BOUNDARY_APPROVAL' })
  @IsString()
  source!: string;

  @ApiProperty({ description: '输入坐标系', enum: ['WGS84', 'GCJ02', 'BD09'], example: 'WGS84' })
  @IsIn(['WGS84', 'GCJ02', 'BD09'])
  coordinateSystem!: string;

  @ApiProperty({ description: 'GeoJSON', example: { type: 'FeatureCollection', features: [] } })
  @IsObject()
  geoJson!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '图层样式 JSON', example: { stroke: '#18a058', fill: '#18a05833' } })
  @IsOptional()
  @IsObject()
  styleJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否可见', example: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
