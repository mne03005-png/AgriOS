import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { BillingService } from '../billing/billing.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';
import { CreateDroneOperationDto } from './dto/create-drone-operation.dto';
import { ImportDroneOperationDto } from './dto/import-drone-operation.dto';
import { LinkDroneOperationFieldDto } from './dto/link-drone-operation-field.dto';
import { UpdateDroneOperationDto } from './dto/update-drone-operation.dto';
import { DjiImportService } from './dji-import.service';
import { DroneFieldMatchingService } from './drone-field-matching.service';
import { DroneStatisticsService } from './drone-statistics.service';

type UploadedDroneFile = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

const fileTypeByExt: Record<string, ImportDroneOperationDto['fileType']> = {
  '.kml': 'KML',
  '.geojson': 'GEOJSON',
  '.json': 'GEOJSON',
  '.csv': 'CSV',
  '.kmz': 'KMZ',
  '.zip': 'FLIGHT_RECORD_ZIP',
  '.tif': 'GEOTIFF',
  '.tiff': 'GEOTIFF',
  '.tfw': 'GEOTIFF'
};

@Injectable()
export class DroneOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly djiImportService: DjiImportService,
    private readonly statisticsService: DroneStatisticsService,
    private readonly matchingService: DroneFieldMatchingService,
    private readonly billingService: BillingService,
    private readonly eventBus: EventBusService,
    private readonly farmActivityService: FarmActivityService
  ) {}

  async import(dto: ImportDroneOperationDto) {
    const tenantId = this.requestContext.getTenantId();
    const job = await (this.prisma as any).droneImportJob.create({
      data: {
        tenantId,
        farmId: dto.farmId,
        fieldId: dto.fieldId,
        source: dto.source,
        fileName: dto.fileName,
        fileType: dto.fileType,
        status: 'PARSING'
      }
    });

    try {
      const parsed = this.djiImportService.parseImportPayload(dto);
      await (this.prisma as any).droneImportJob.update({ where: { id: job.id }, data: { status: 'PARSED', parsedJson: parsed } });
      this.eventBus.publish('drone.import.parsed', { farmId: dto.farmId, fieldId: dto.fieldId, entityType: 'DroneImportJob', entityId: job.id, fileType: dto.fileType }, tenantId);

      let operation = await (this.prisma as any).droneOperation.create({
        data: {
          tenantId,
          farmId: dto.farmId,
          fieldId: dto.fieldId,
          droneBrand: dto.droneBrand ?? 'DJI',
          droneModel: dto.droneModel,
          operationType: dto.operationType,
          source: dto.source,
          sourceFileName: dto.fileName,
          coordinateSystem: 'WGS84',
          plannedAreaMu: dto.plannedAreaMu,
          actualAreaMu: dto.actualAreaMu,
          flightDistanceM: dto.flightDistanceM,
          flightDurationS: dto.flightDurationS,
          sprayVolumeL: dto.sprayVolumeL,
          chemicalName: dto.chemicalName,
          routeGeoJson: parsed.routeGeoJson,
          coverageGeoJson: parsed.coverageGeoJson,
          prescriptionJson: parsed.prescriptionJson,
          rawJson: parsed.rawJson,
          status: 'PARSED',
          startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
          finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined
        }
      });

      operation = await this.matchingService.matchField(operation);
      operation = await this.updateStats(operation);
      const mapLayers = await this.createMapLayers(operation);
      const review = await this.createReviewForOperation(operation);
      await this.recordImportUsage(operation);
      this.eventBus.publish('drone.operation.imported', { farmId: operation.farmId, fieldId: operation.fieldId, entityType: 'DroneOperation', entityId: operation.id, jobId: job.id }, tenantId);
      await this.farmActivityService.create({
        tenantId,
        farmId: operation.farmId,
        fieldId: operation.fieldId,
        type: 'DRONE_OPERATION_IMPORTED',
        title: `无人机作业导入：${operation.sourceFileName ?? operation.id}`,
        refType: 'DroneOperation',
        refId: operation.id,
        metadata: { operationType: operation.operationType, source: operation.source, mapLayerIds: mapLayers.map((item: any) => item.id) }
      });
      return { importJob: await this.getImportJob(job.id), operation, mapLayers, review };
    } catch (error) {
      await (this.prisma as any).droneImportJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  async importFile(file: UploadedDroneFile | undefined, body: Record<string, unknown>) {
    if (!file?.buffer) throw new BadRequestException('file is required');
    const ext = this.fileExt(file.originalname);
    const fileType = fileTypeByExt[ext];
    if (!fileType) throw new BadRequestException(`Unsupported drone file extension: ${ext || 'unknown'}`);

    const tenantId = this.requestContext.getTenantId();
    const farmId = this.requiredString(body.farmId, 'farmId');
    const source = this.optionalString(body.source) ?? fileType;
    const operationType = this.requiredString(body.operationType, 'operationType');
    const fieldId = this.optionalString(body.fieldId);
    this.eventBus.publish('drone.import.file.received', { farmId, fieldId, fileName: file.originalname, fileType, entityType: 'DroneImportJob' }, tenantId);

    if (fileType === 'KMZ' || fileType === 'FLIGHT_RECORD_ZIP') {
      const job = await this.createFailedImportJob({
        tenantId,
        farmId,
        fieldId,
        source,
        fileName: file.originalname,
        fileType,
        errorMessage: `${fileType} extraction is not implemented in P11.5. Please upload KML, GeoJSON or CSV for parsing.`
      });
      return { importJob: job, operation: null, mapLayers: [], limitation: job.errorMessage };
    }

    try {
      const rawText = ['KML', 'CSV'].includes(fileType) ? file.buffer.toString('utf8') : undefined;
      const rawJson = fileType === 'GEOJSON' ? this.parseJsonFile(file.buffer, file.originalname) : undefined;
      const dto: ImportDroneOperationDto = {
        farmId,
        fieldId,
        source: source as ImportDroneOperationDto['source'],
        fileName: file.originalname,
        fileType,
        operationType: operationType as ImportDroneOperationDto['operationType'],
        coordinateSystem: (this.optionalString(body.coordinateSystem) ?? 'WGS84') as ImportDroneOperationDto['coordinateSystem'],
        droneBrand: this.optionalString(body.droneBrand) ?? 'DJI',
        droneModel: this.optionalString(body.droneModel),
        chemicalName: this.optionalString(body.chemicalName),
        sprayVolumeL: this.optionalNumber(body.sprayVolumeL),
        flightDurationS: this.optionalNumber(body.flightDurationS),
        plannedAreaMu: this.optionalNumber(body.plannedAreaMu),
        rawText,
        rawJson,
        prescriptionJson:
          fileType === 'GEOTIFF'
            ? {
                type: 'GEOTIFF_METADATA',
                fileName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size,
                note: 'P11.5 only records raster metadata. Raster analysis is reserved for a later stage.'
              }
            : undefined
      };
      return this.import(dto);
    } catch (error) {
      const job = await this.createFailedImportJob({
        tenantId,
        farmId,
        fieldId,
        source,
        fileName: file.originalname,
        fileType,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw new BadRequestException({ message: job.errorMessage, importJob: job });
    }
  }

  create(dto: CreateDroneOperationDto) {
    return (this.prisma as any).droneOperation.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        ...dto,
        source: dto.source,
        coordinateSystem: 'WGS84',
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined
      }
    });
  }

  list(query: Record<string, unknown>) {
    return (this.prisma as any).droneOperation.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.operationType === 'string' ? { operationType: query.operationType } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findOne(id: string) {
    const operation = await (this.prisma as any).droneOperation.findUnique({ where: { id } });
    if (!operation) throw new NotFoundException('Drone operation not found');
    return operation;
  }

  async update(id: string, dto: UpdateDroneOperationDto) {
    await this.findOne(id);
    const updated = await (this.prisma as any).droneOperation.update({
      where: { id },
      data: {
        ...dto,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined
      }
    });
    return this.updateStats(updated);
  }

  async linkField(id: string, dto: LinkDroneOperationFieldDto) {
    const existing = await this.findOne(id);
    const linked = await (this.prisma as any).droneOperation.update({
      where: { id },
      data: {
        fieldId: dto.fieldId ?? existing.fieldId,
        fieldBoundaryId: dto.fieldBoundaryId ?? existing.fieldBoundaryId,
        status: dto.fieldId || dto.fieldBoundaryId || existing.fieldId ? 'LINKED' : existing.status
      }
    });
    const updated = await this.updateStats(linked);
    this.eventBus.publish('drone.operation.linked', { farmId: updated.farmId, fieldId: updated.fieldId, entityType: 'DroneOperation', entityId: updated.id }, updated.tenantId);
    return updated;
  }

  async generateReport(id: string) {
    const operation = await this.findOne(id);
    const reportType = this.reportType(operation.operationType);
    const candidateLayers = await (this.prisma as any).mapLayer.findMany({
      where: { farmId: operation.farmId, source: 'DRONE_OPERATION_IMPORT' },
      take: 200,
      orderBy: { createdAt: 'desc' }
    });
    const mapLayers = candidateLayers.filter((item: any) => item.styleJson?.droneOperationId === id);
    const stats = operation.rawJson?.statistics ?? {};
    const needsManualReview = Boolean(operation.rawJson?.matchResult?.needsManualLink || !operation.fieldId || !operation.fieldBoundaryId);
    const operationCostSummary = await this.operationCostSummary(operation);
    const report = await (this.prisma as any).operationReport.create({
      data: {
        tenantId: operation.tenantId,
        farmId: operation.farmId,
        type: reportType,
        refId: operation.id,
        title: `无人机${this.operationTypeLabel(operation.operationType)}作业报告`,
        summaryJson: {
          source: operation.source,
          fileName: operation.sourceFileName,
          operationType: operation.operationType,
          fieldId: operation.fieldId,
          fieldBoundaryId: operation.fieldBoundaryId,
          droneModel: operation.droneModel,
          chemicalName: operation.chemicalName,
          fieldAreaMu: stats.fieldAreaMu,
          prescriptionSummary: operation.prescriptionJson,
          needsManualReview,
          operationCostSummary,
          mapLayerIds: mapLayers.map((item: any) => item.id)
        },
        metricsJson: {
          actualAreaMu: operation.actualAreaMu,
          coverageRate: operation.coverageRate,
          missedAreaMu: operation.missedAreaMu,
          repeatedAreaMu: operation.repeatedAreaMu,
          flightDistanceM: operation.flightDistanceM,
          flightDurationS: operation.flightDurationS,
          sprayVolumeL: operation.sprayVolumeL,
          dosagePerMu: operation.dosagePerMu,
          overlapRate: operation.overlapRate,
          coverageBBox: stats.coverageBBox,
          fieldBBox: stats.fieldBBox
        }
      }
    });
    await this.recordReportUsage(operation, report.id);
    this.eventBus.publish('drone.operation.report.generated', { farmId: operation.farmId, fieldId: operation.fieldId, entityType: 'OperationReport', entityId: report.id, droneOperationId: id }, operation.tenantId);
    await this.farmActivityService.create({
      tenantId: operation.tenantId,
      farmId: operation.farmId,
      fieldId: operation.fieldId,
      type: operation.operationType === 'MAPPING' ? 'DRONE_MAPPING_COMPLETED' : operation.operationType === 'SPRAYING' ? 'DRONE_SPRAYING_COMPLETED' : 'DRONE_OPERATION_IMPORTED',
      title: `无人机${this.operationTypeLabel(operation.operationType)}报告已生成`,
      refType: 'OperationReport',
      refId: report.id,
      metadata: { droneOperationId: id, needsManualReview }
    });
    return report;
  }

  async getImportJob(id: string) {
    const job = await (this.prisma as any).droneImportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Drone import job not found');
    return job;
  }

  private async updateStats(operation: any) {
    const stats = await this.statisticsService.calculateDroneOperationStats(operation);
    const updated = await (this.prisma as any).droneOperation.update({
      where: { id: operation.id },
      data: {
        actualAreaMu: stats.actualAreaMu,
        flightDistanceM: stats.flightDistanceM,
        coverageRate: stats.coverageRate,
        missedAreaMu: stats.missedAreaMu,
        overlapRate: stats.overlapRate,
        repeatedAreaMu: stats.repeatedAreaMu,
        dosagePerMu: stats.dosagePerMu,
        rawJson: {
          ...(operation.rawJson ?? {}),
          statistics: stats,
          statisticsNote: stats.statisticsNote
        }
      }
    });
    this.eventBus.publish('drone.operation.stats.calculated', { farmId: updated.farmId, fieldId: updated.fieldId, entityType: 'DroneOperation', entityId: updated.id }, updated.tenantId);
    return updated;
  }

  private async createReviewForOperation(operation: any) {
    const existing = await (this.prisma as any).droneOperationReview.findFirst({ where: { droneOperationId: operation.id } });
    if (existing) return existing;
    const coverageRate = Number(operation.coverageRate);
    const normalizedRate = Number.isFinite(coverageRate) ? (coverageRate > 1 ? coverageRate / 100 : coverageRate) : null;
    const needsManualLink = Boolean(operation.rawJson?.matchResult?.needsManualLink || !operation.fieldId);
    const status = needsManualLink ? 'NEEDS_MANUAL_LINK' : normalizedRate !== null && normalizedRate < 0.9 ? 'NEEDS_BOUNDARY_FIX' : 'PENDING';
    const review = await (this.prisma as any).droneOperationReview.create({
      data: {
        tenantId: operation.tenantId,
        farmId: operation.farmId,
        droneOperationId: operation.id,
        status,
        correctedFieldId: operation.fieldId,
        correctedFieldBoundaryId: operation.fieldBoundaryId,
        confirmedAreaMu: operation.actualAreaMu,
        confirmedCoverageRate: operation.coverageRate,
        confirmedMissedAreaMu: operation.missedAreaMu,
        confirmedRepeatedAreaMu: operation.repeatedAreaMu,
        reviewNote: needsManualLink ? '需要人工绑定地块' : status === 'NEEDS_BOUNDARY_FIX' ? '覆盖率低于 90%，建议人工核查覆盖区' : undefined
      }
    });
    this.eventBus.publish('drone.review.created', { farmId: operation.farmId, fieldId: operation.fieldId, entityType: 'DroneOperationReview', entityId: review.id, droneOperationId: operation.id, status }, operation.tenantId);
    return review;
  }

  private async operationCostSummary(operation: any) {
    const items = await (this.prisma as any).operationCost.findMany({ where: { refType: 'DroneOperation', refId: operation.id } });
    const byCategory: Record<string, number> = {};
    for (const item of items) byCategory[item.category] = Number(((byCategory[item.category] ?? 0) + Number(item.amount ?? 0)).toFixed(2));
    return {
      totalAmount: Number(items.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0).toFixed(2)),
      currency: items[0]?.currency ?? 'CNY',
      byCategory,
      count: items.length
    };
  }

  private async createMapLayers(operation: any) {
    const layers = [];
    if (operation.routeGeoJson) {
      layers.push(await this.createLayer(operation, 'DRONE_ROUTE', `${operation.sourceFileName ?? operation.id} 航线`, operation.routeGeoJson, { stroke: '#1677ff', layerRole: 'DRONE_ROUTE' }));
    }
    if (operation.coverageGeoJson) {
      layers.push(await this.createLayer(operation, 'ORTHOMOSAIC', `${operation.sourceFileName ?? operation.id} 覆盖范围`, operation.coverageGeoJson, { stroke: '#16a34a', fill: '#16a34a33', layerRole: 'DRONE_COVERAGE' }));
    }
    if (operation.prescriptionJson) {
      layers.push(await this.createLayer(operation, 'ORTHOMOSAIC', `${operation.sourceFileName ?? operation.id} 处方/影像占位`, operation.prescriptionJson, { layerRole: 'PRESCRIPTION_OR_ORTHOMOSAIC', fill: '#f59e0b33' }));
    }
    return layers;
  }

  private createLayer(operation: any, type: string, name: string, geoJson: unknown, styleJson: Record<string, unknown>) {
    return (this.prisma as any).mapLayer.create({
      data: {
        tenantId: operation.tenantId,
        farmId: operation.farmId,
        name,
        type,
        source: 'DRONE_OPERATION_IMPORT',
        coordinateSystem: 'WGS84',
        geoJson: geoJson as any,
        styleJson: { ...styleJson, droneOperationId: operation.id, operationType: operation.operationType },
        isVisible: true
      }
    });
  }

  private async createFailedImportJob(input: {
    tenantId?: string;
    farmId: string;
    fieldId?: string;
    source: string;
    fileName: string;
    fileType: string;
    errorMessage: string;
  }) {
    return (this.prisma as any).droneImportJob.create({
      data: {
        tenantId: input.tenantId,
        farmId: input.farmId,
        fieldId: input.fieldId,
        source: input.source,
        fileName: input.fileName,
        fileType: input.fileType,
        status: 'FAILED',
        errorMessage: input.errorMessage
      }
    });
  }

  private parseJsonFile(buffer: Buffer, fileName: string) {
    try {
      return JSON.parse(buffer.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(`Invalid GeoJSON/JSON file: ${fileName}`);
    }
  }

  private fileExt(fileName: string) {
    const index = fileName.lastIndexOf('.');
    return index >= 0 ? fileName.slice(index).toLowerCase() : '';
  }

  private requiredString(value: unknown, field: string) {
    const text = this.optionalString(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private reportType(operationType: string) {
    const map: Record<string, string> = {
      MAPPING: 'DRONE_MAPPING',
      SPRAYING: 'DRONE_SPRAYING',
      SPREADING: 'DRONE_SPREADING',
      SCOUTING: 'DRONE_SCOUTING'
    };
    return map[operationType] ?? 'DRONE_MAPPING';
  }

  private operationTypeLabel(operationType: string) {
    const labels: Record<string, string> = { MAPPING: '测绘', SPRAYING: '喷洒', SPREADING: '撒播', SCOUTING: '巡田', SEEDING: '播种' };
    return labels[operationType] ?? operationType;
  }

  private async recordImportUsage(operation: any) {
    const tenantId = operation.tenantId ?? this.requestContext.getTenantId();
    if (!tenantId) return;
    await this.billingService.recordUsage({
      tenantId,
      farmId: operation.farmId,
      fieldId: operation.fieldId,
      type: 'DRONE_OPERATION',
      quantity: 1,
      unit: 'operation',
      amount: 0,
      refType: 'DroneOperation',
      refId: operation.id
    });
  }

  private async recordReportUsage(operation: any, reportId: string) {
    const tenantId = operation.tenantId ?? this.requestContext.getTenantId();
    if (!tenantId) return;
    await this.billingService.recordUsage({
      tenantId,
      farmId: operation.farmId,
      fieldId: operation.fieldId,
      type: 'DRONE_OPERATION_REPORT',
      quantity: 1,
      unit: 'report',
      amount: 0,
      refType: 'OperationReport',
      refId: reportId
    });
  }
}
