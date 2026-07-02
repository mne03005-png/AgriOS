import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString } from 'class-validator';

export class ImportGeojsonDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '输入坐标系', enum: ['WGS84', 'GCJ02', 'BD09'], example: 'WGS84' })
  @IsIn(['WGS84', 'GCJ02', 'BD09'])
  coordinateSystem!: string;

  @ApiProperty({ description: 'GeoJSON 内容', example: { type: 'FeatureCollection', features: [] } })
  @IsObject()
  geoJson!: Record<string, unknown>;
}
