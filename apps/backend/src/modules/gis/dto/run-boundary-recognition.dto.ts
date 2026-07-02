import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class RunBoundaryRecognitionDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '识别类型', enum: ['FIELD_BOUNDARY', 'WATER_BODY', 'OBSTACLE', 'ROAD', 'TREE_ROW', 'IRRIGATION_ZONE'], example: 'FIELD_BOUNDARY' })
  @IsIn(['FIELD_BOUNDARY', 'WATER_BODY', 'OBSTACLE', 'ROAD', 'TREE_ROW', 'IRRIGATION_ZONE'])
  type!: string;

  @ApiPropertyOptional({ description: '输入图层 ID', example: 'layer_001' })
  @IsOptional()
  @IsString()
  mapLayerId?: string;

  @ApiPropertyOptional({ description: 'GPS 轨迹 ID', example: 'track_001' })
  @IsOptional()
  @IsString()
  gpsTrackId?: string;

  @ApiPropertyOptional({ description: '无人机地图任务 ID', example: 'drone_job_001' })
  @IsOptional()
  @IsString()
  droneMapJobId?: string;

  @ApiPropertyOptional({ description: '上传 GeoJSON', example: { type: 'Polygon', coordinates: [] } })
  @IsOptional()
  @IsObject()
  geoJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '输入坐标系', enum: ['WGS84', 'GCJ02', 'BD09'], example: 'WGS84' })
  @IsOptional()
  @IsIn(['WGS84', 'GCJ02', 'BD09'])
  coordinateSystem?: string;
}
