import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BoundaryRecognitionService } from './boundary-recognition.service';
import { CoordinateSystemCode } from './coordinate-transform.service';
import { CreateFieldBoundaryDto } from './dto/create-field-boundary.dto';
import { CreateMapLayerDto } from './dto/create-map-layer.dto';
import { ImportGpsTrackDto } from './dto/import-gps-track.dto';
import { RunBoundaryRecognitionDto } from './dto/run-boundary-recognition.dto';
import { UpdateFieldBoundaryDto } from './dto/update-field-boundary.dto';
import { DroneMapJobService } from './drone-map-job.service';
import { GisService } from './gis.service';
import { GpsTrackService } from './gps-track.service';

@ApiTags('P7.2 GIS')
@Controller('gis')
export class GisController {
  constructor(
    private readonly gisService: GisService,
    private readonly gpsTrackService: GpsTrackService,
    private readonly droneMapJobService: DroneMapJobService,
    private readonly boundaryRecognitionService: BoundaryRecognitionService
  ) {}

  @Post('field-boundaries')
  @ApiCreatedResponse({ description: '创建地块边界候选' })
  createFieldBoundary(@Body() dto: CreateFieldBoundaryDto) {
    return this.gisService.createFieldBoundary(dto);
  }

  @Get('field-boundaries')
  @ApiOkResponse({ description: '查询地块边界列表' })
  findFieldBoundaries(@Query() query: Record<string, unknown>) {
    return this.gisService.findFieldBoundaries(query);
  }

  @Get('field-boundaries/:id')
  @ApiOkResponse({ description: '查询地块边界详情' })
  findFieldBoundary(@Param('id') id: string) {
    return this.gisService.findFieldBoundary(id);
  }

  @Patch('field-boundaries/:id')
  @ApiOkResponse({ description: '更新地块边界' })
  updateFieldBoundary(@Param('id') id: string, @Body() dto: UpdateFieldBoundaryDto) {
    return this.gisService.updateFieldBoundary(id, dto);
  }

  @Post('field-boundaries/:id/approve')
  @ApiOkResponse({ description: '审核通过边界并生成 FIELD 图层' })
  approveFieldBoundary(@Param('id') id: string) {
    return this.gisService.approveFieldBoundary(id);
  }

  @Post('field-boundaries/:id/archive')
  @ApiOkResponse({ description: '归档地块边界' })
  archiveFieldBoundary(@Param('id') id: string) {
    return this.gisService.archiveFieldBoundary(id);
  }

  @Post('gps-tracks/import')
  @ApiCreatedResponse({ description: '导入 GPS 轨迹' })
  importGpsTrack(@Body() dto: ImportGpsTrackDto) {
    return this.gpsTrackService.importTrack(dto);
  }

  @Get('gps-tracks')
  @ApiOkResponse({ description: '查询 GPS 轨迹列表' })
  gpsTracks(@Query() query: Record<string, unknown>) {
    return this.gpsTrackService.findAll(query);
  }

  @Post('map-layers')
  @ApiCreatedResponse({ description: '创建地图图层' })
  createMapLayer(@Body() dto: CreateMapLayerDto) {
    return this.gisService.createMapLayer(dto);
  }

  @Get('map-layers')
  @ApiOkResponse({ description: '查询地图图层列表' })
  mapLayers(@Query() query: Record<string, unknown>) {
    return this.gisService.findMapLayers(query);
  }

  @Patch('map-layers/:id')
  @ApiOkResponse({ description: '更新地图图层' })
  updateMapLayer(@Param('id') id: string, @Body() dto: Partial<CreateMapLayerDto>) {
    return this.gisService.updateMapLayer(id, dto);
  }

  @Post('recognition/field-boundary')
  @ApiOkResponse({ description: '运行地块边界识别占位流程' })
  runBoundaryRecognition(@Body() dto: RunBoundaryRecognitionDto) {
    return this.boundaryRecognitionService.runFieldBoundary(dto);
  }

  @Get('recognition/jobs/:id')
  @ApiOkResponse({ description: '查询识别任务' })
  recognitionJob(@Param('id') id: string) {
    return this.boundaryRecognitionService.findJob(id);
  }

  @Post('coordinate/convert')
  @ApiOkResponse({ description: '坐标点或 GeoJSON 坐标系转换' })
  convertCoordinate(
    @Body()
    body: {
      lng?: number;
      lat?: number;
      geoJson?: Record<string, unknown>;
      from: CoordinateSystemCode;
      to: CoordinateSystemCode;
    }
  ) {
    if (body.geoJson) return this.gisService.convertGeoJSON({ geoJson: body.geoJson, from: body.from, to: body.to });
    return this.gisService.convertPoint({ lng: Number(body.lng), lat: Number(body.lat), from: body.from, to: body.to });
  }

  @Post('drone-map-jobs')
  @ApiCreatedResponse({ description: '创建无人机地图任务基础记录' })
  createDroneMapJob(
    @Body()
    body: {
      farmId: string;
      name: string;
      imageCount?: number;
      flightTrack?: Record<string, unknown>;
      coordinateSystem?: CoordinateSystemCode;
      orthomosaicUrl?: string;
    }
  ) {
    return this.droneMapJobService.create(body);
  }

  @Get('drone-map-jobs')
  @ApiOkResponse({ description: '查询无人机地图任务列表' })
  droneMapJobs(@Query() query: Record<string, unknown>) {
    return this.droneMapJobService.findAll(query);
  }
}
