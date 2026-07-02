import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ImportGpsTrackDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '轨迹名称', example: '手持GPS绕洋葱地A一圈' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '轨迹来源', example: 'handheld_gps' })
  @IsString()
  source!: string;

  @ApiProperty({ description: '输入坐标系', enum: ['WGS84', 'GCJ02', 'BD09'], example: 'WGS84' })
  @IsIn(['WGS84', 'GCJ02', 'BD09'])
  coordinateSystem!: string;

  @ApiProperty({ description: 'GeoJSON LineString 或点数组', example: { type: 'LineString', coordinates: [[118.1, 36.7], [118.2, 36.7], [118.2, 36.8], [118.1, 36.7]] } })
  @IsObject()
  trackJson!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '原始文件名', example: 'gps-track-2026-06-30.geojson' })
  @IsOptional()
  @IsString()
  rawFileName?: string;

  @ApiPropertyOptional({ description: '是否闭合轨迹并生成地块边界候选', example: true })
  @IsOptional()
  @IsBoolean()
  closeLoop?: boolean;
}
