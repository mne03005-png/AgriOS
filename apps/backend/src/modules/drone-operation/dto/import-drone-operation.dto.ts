import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

const sources = ['DJI_SMARTFARM', 'DJI_TERRA', 'DJI_PILOT', 'DJI_REMOTE_CONTROLLER', 'KML', 'KMZ', 'GEOJSON', 'GEOTIFF', 'CSV', 'FLIGHT_RECORD_ZIP', 'MANUAL_IMPORT'] as const;
const operationTypes = ['MAPPING', 'SPRAYING', 'SPREADING', 'SCOUTING', 'SEEDING'] as const;
const coordinateSystems = ['WGS84', 'GCJ02', 'BD09'] as const;

export class ImportDroneOperationDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_onion_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '数据来源', enum: sources, example: 'DJI_SMARTFARM' })
  @IsIn(sources)
  source!: (typeof sources)[number];

  @ApiProperty({ description: '文件名', example: 'operation.kml' })
  @IsString()
  fileName!: string;

  @ApiProperty({ description: '文件类型', enum: sources, example: 'KML' })
  @IsIn(sources)
  fileType!: (typeof sources)[number];

  @ApiProperty({ description: '作业类型', enum: operationTypes, example: 'SPRAYING' })
  @IsIn(operationTypes)
  operationType!: (typeof operationTypes)[number];

  @ApiPropertyOptional({ description: '地块 ID', example: 'field_onion_a' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '坐标系，入库统一转为 WGS84', enum: coordinateSystems, example: 'WGS84' })
  @IsOptional()
  @IsIn(coordinateSystems)
  coordinateSystem?: (typeof coordinateSystems)[number];

  @ApiPropertyOptional({ description: '无人机品牌', example: 'DJI' })
  @IsOptional()
  @IsString()
  droneBrand?: string;

  @ApiPropertyOptional({ description: '无人机型号', example: 'DJI Agras T50' })
  @IsOptional()
  @IsString()
  droneModel?: string;

  @ApiPropertyOptional({ description: '原始文本，用于 KML/CSV 轻量解析' })
  @IsOptional()
  @IsString()
  rawText?: string;

  @ApiPropertyOptional({ description: '航线 GeoJSON' })
  @IsOptional()
  @IsObject()
  routeGeoJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '覆盖范围 GeoJSON' })
  @IsOptional()
  @IsObject()
  coverageGeoJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '处方图或 GeoTIFF/TFW 元数据' })
  @IsOptional()
  @IsObject()
  prescriptionJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '计划面积，单位亩', example: 300 })
  @IsOptional()
  @IsNumber()
  plannedAreaMu?: number;

  @ApiPropertyOptional({ description: '作业面积，单位亩', example: 296.4 })
  @IsOptional()
  @IsNumber()
  actualAreaMu?: number;

  @ApiPropertyOptional({ description: '航线长度，单位米', example: 8200 })
  @IsOptional()
  @IsNumber()
  flightDistanceM?: number;

  @ApiPropertyOptional({ description: '飞行时长，单位秒', example: 1800 })
  @IsOptional()
  @IsNumber()
  flightDurationS?: number;

  @ApiPropertyOptional({ description: '药液用量，单位升', example: 92 })
  @IsOptional()
  @IsNumber()
  sprayVolumeL?: number;

  @ApiPropertyOptional({ description: '药剂或肥料名称', example: '洋葱叶面肥' })
  @IsOptional()
  @IsString()
  chemicalName?: string;

  @ApiPropertyOptional({ description: '开始时间 ISO 字符串' })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiPropertyOptional({ description: '结束时间 ISO 字符串' })
  @IsOptional()
  @IsString()
  finishedAt?: string;

  @ApiPropertyOptional({ description: '原始 JSON' })
  @IsOptional()
  @IsObject()
  rawJson?: Record<string, unknown>;
}
