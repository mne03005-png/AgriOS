import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { SafetyService } from '../safety/safety.service';
import { ActionQueueService } from '../action-queue/action-queue.service';

type MobileUser = NonNullable<AuthenticatedRequest['user']>;

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService,
    private readonly moduleRef: ModuleRef
  ) {}

  async cockpit(farmId: string, user: MobileUser) {
    farmId = await this.resolveFarmId(farmId, user);
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId, ...this.tenantWhere(user) }, include: { fields: true } });
    if (!farm) throw new NotFoundException('Farm not found');
    const fieldIds = farm.fields.map((field: any) => field.id);
    const [
      deviceCount,
      onlineDeviceCount,
      pendingAlerts,
      latestDecision,
      latestActionPlans,
      mapLayers,
      telemetrySnapshots,
      activeRotationRuns,
      fertigationTasks,
      latestActivities,
      droneOperations
    ] = await Promise.all([
      this.prisma.device.count({ where: { fieldId: { in: fieldIds } } }),
      this.prisma.device.count({ where: { fieldId: { in: fieldIds }, online: true } }),
      (this.prisma as any).safetyAlert.count({ where: { farmId, status: 'OPEN' } }),
      (this.prisma as any).decisionRecord.findFirst({ where: { fieldId: { in: fieldIds } }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).actionPlan.findMany({ where: { fieldId: { in: fieldIds } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      (this.prisma as any).mapLayer.findMany({ where: { farmId, isVisible: true }, take: 10, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).deviceTelemetrySnapshot.findMany({ where: { farmId }, orderBy: { reportedAt: 'desc' } }),
      (this.prisma as any).irrigationRotationRun.findMany({ where: { farmId, status: { in: ['PENDING', 'RUNNING'] } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      (this.prisma as any).fertigationTask.findMany({ where: { farmId, status: { in: ['QUEUED', 'RUNNING', 'BLOCKED'] } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      (this.prisma as any).farmActivity.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      (this.prisma as any).droneOperation.findMany({ where: { farmId, status: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'desc' }, take: 10 })
    ]);
    const pressureValues = telemetrySnapshots.map((item: any) => Number(item.pressureKpa)).filter((value: number) => Number.isFinite(value));
    const flowValues = telemetrySnapshots.map((item: any) => Number(item.flowRateM3h)).filter((value: number) => Number.isFinite(value));
    return {
      farm,
      weather: { source: 'mock', summary: '晴，适合巡田，注意午后高温。' },
      deviceOnlineRate: deviceCount ? Number(((onlineDeviceCount / deviceCount) * 100).toFixed(2)) : 0,
      autoModeStatus: { enabled: process.env.ENABLE_AUTO_EXECUTION === 'true', policy: 'guarded' },
      todayRiskLevel: latestDecision?.recommendation === 'SHOULD_IRRIGATE' ? 'HIGH' : 'NORMAL',
      activeIrrigationZones: latestActionPlans.filter((plan: any) => plan.status === 'EXECUTING').length,
      todayWaterUsage: 0,
      pendingAlerts,
      pressureSummary: { avgKpa: this.average(pressureValues), latest: telemetrySnapshots.find((item: any) => item.pressureKpa !== null) ?? null },
      flowSummary: { avgM3h: this.average(flowValues), latest: telemetrySnapshots.find((item: any) => item.flowRateM3h !== null) ?? null },
      pumpStatus: telemetrySnapshots.filter((item: any) => item.pumpRunningStatus).map((item: any) => ({ deviceId: item.deviceId, status: item.pumpRunningStatus, reportedAt: item.reportedAt })),
      fertigationStatus: fertigationTasks,
      tankLevelWarnings: telemetrySnapshots.filter((item: any) => Number(item.fertilizerTankLevelL ?? item.waterTankLevelL) < 20),
      activeRotationRuns,
      latestDecision,
      latestActionPlans,
      latestActivities,
      droneOperations,
      miniMapLayers: mapLayers,
      quickActions: { emergencyStop: true, manualValve: false, autoMode: false, alerts: true, readOnlyReason: 'REAL_HARDWARE_WRITE_GATES_REMAIN_DISABLED' }
    };
  }

  async map(farmId: string, user: MobileUser) {
    farmId = await this.resolveFarmId(farmId, user);
    const [boundaries, layers, devices, tracks, rotationGroups, fertilizerTanks, droneOperations] = await Promise.all([
      (this.prisma as any).fieldBoundary.findMany({ where: { farmId, status: { not: 'ARCHIVED' } } }),
      (this.prisma as any).mapLayer.findMany({ where: { farmId, isVisible: true } }),
      this.prisma.device.findMany({ where: { field: { farmId } }, include: { field: true } }),
      (this.prisma as any).gpsTrack.findMany({ where: { farmId }, take: 20, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).irrigationRotationGroup.findMany({ where: { farmId, status: { not: 'ARCHIVED' } }, include: { valves: true } }),
      (this.prisma as any).fertilizerTank.findMany({ where: { farmId, status: { not: 'ARCHIVED' } } }),
      (this.prisma as any).droneOperation.findMany({ where: { farmId, status: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'desc' }, take: 50 })
    ]);
    return {
      fieldBoundaries: boundaries,
      irrigationZones: layers.filter((item: any) => item.type === 'IRRIGATION_ZONE'),
      valveMarkers: devices.filter((item) => item.type === 'VALVE'),
      sensorMarkers: devices.filter((item) => String(item.type).includes('SENSOR')),
      pumpMarkers: devices.filter((item) => item.type === 'PUMP'),
      pressureSensors: devices.filter((item) => String(item.name).includes('压力')),
      flowMeters: devices.filter((item) => item.type === 'FLOW_METER'),
      fertigationDevices: devices.filter((item) => String(item.name).includes('施肥') || String(item.name).includes('水肥')),
      fertilizerTanks,
      rotationGroups,
      waterChannels: layers.filter((item: any) => item.type === 'WATER'),
      pipelines: layers.filter((item: any) => item.type === 'PIPELINE'),
      obstacles: layers.filter((item: any) => item.type === 'OBSTACLE'),
      droneRoutes: layers.filter((item: any) => item.type === 'DRONE_ROUTE'),
      droneOperations,
      droneRouteLayers: layers.filter((item: any) => item.type === 'DRONE_ROUTE' && item.source === 'DRONE_OPERATION_IMPORT'),
      droneCoverageLayers: layers.filter((item: any) => item.source === 'DRONE_OPERATION_IMPORT' && item.styleJson?.operationType),
      prescriptionLayers: layers.filter((item: any) => item.source === 'DRONE_OPERATION_IMPORT' && item.styleJson?.type === 'PRESCRIPTION'),
      gpsTracks: tracks,
      orthomosaicLayers: layers.filter((item: any) => item.type === 'ORTHOMOSAIC')
    };
  }

  async fieldDetail(fieldId: string, user: MobileUser) {
    const field = await this.prisma.field.findFirst({ where: { id: fieldId, ...this.tenantWhere(user) }, include: { devices: true } });
    if (!field) throw new NotFoundException('Field not found');
    const [boundary, season, latestMoisture, decisions, recipe, simulation, telemetrySnapshots, droneOperationRecords, droneOperationReviews, operationCosts, cropHealthObservations, yieldFactors, latestOperationReports, latestDroneSprayingReport, latestMappingLayer] = await Promise.all([
      (this.prisma as any).fieldBoundary.findFirst({ where: { fieldId, status: 'APPROVED' }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.cropSeason.findFirst({ where: { fieldId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.sensorRecord.findFirst({ where: { fieldId, type: 'SOIL_MOISTURE' as any }, orderBy: { reportedAt: 'desc' } }),
      (this.prisma as any).decisionRecord.findMany({ where: { fieldId }, orderBy: { createdAt: 'desc' }, take: 5, include: { actionPlans: true } }),
      (this.prisma as any).cropIrrigationRecipe.findFirst({ where: { cropType: { equals: '洋葱' }, isActive: true }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).wettingSimulation.findFirst({ where: { fieldId }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).deviceTelemetrySnapshot.findMany({ where: { fieldId }, orderBy: { reportedAt: 'desc' } }),
      (this.prisma as any).droneOperation.findMany({ where: { fieldId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      (this.prisma as any).droneOperationReview.findMany({ where: { farmId: field.farmId, correctedFieldId: fieldId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      (this.prisma as any).operationCost.findMany({ where: { fieldId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      (this.prisma as any).cropHealthObservation.findMany({ where: { fieldId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      (this.prisma as any).yieldFactor.findMany({ where: { fieldId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      (this.prisma as any).operationReport.findMany({ where: { farmId: field.farmId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      (this.prisma as any).operationReport.findFirst({ where: { farmId: field.farmId, type: 'DRONE_SPRAYING' }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).mapLayer.findFirst({ where: { type: 'ORTHOMOSAIC', source: 'DRONE_OPERATION_IMPORT' }, orderBy: { createdAt: 'desc' } })
    ]);
    const operationCostSummary = this.costSummary(operationCosts);
    return {
      field,
      boundary,
      cropType: season?.cropName,
      cropStage: season?.status,
      soilType: field.soilType,
      latestMoisture,
      latestDeviceTelemetry: telemetrySnapshots,
      moistureTrend: [],
      irrigationHistory: await this.prisma.irrigationRecord.findMany({ where: { fieldId }, orderBy: { startTime: 'desc' }, take: 10 }),
      aiRecommendation: decisions[0] ?? null,
      valveStatus: field.devices.filter((item) => item.type === 'VALVE'),
      sensorStatus: field.devices.filter((item) => String(item.type).includes('SENSOR')),
      droneOperationRecords,
      droneOperationReviews,
      operationCostSummary,
      cropHealthObservations,
      yieldFactors,
      latestOperationReports,
      latestDroneSprayingReport,
      latestMappingLayer,
      cropIrrigationRecipe: recipe,
      wettingSimulationPreview: simulation
    };
  }

  async aiRecommendations(farmId: string, user: MobileUser) {
    farmId = await this.resolveFarmId(farmId, user);
    const fields = await this.prisma.field.findMany({ where: { farmId }, select: { id: true } });
    return (this.prisma as any).decisionRecord.findMany({ where: { fieldId: { in: fields.map((item) => item.id) } }, include: { actionPlans: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  async operations(farmId: string, user: MobileUser) {
    farmId = await this.resolveFarmId(farmId, user);
    const fields = await this.prisma.field.findMany({ where: { farmId }, select: { id: true } });
    const fieldIds = fields.map((item) => item.id);
    const [actionPlans, rotationRuns, fertigationTasks, dissolveTasks, pumpOperations, droneOperations] = await Promise.all([
      (this.prisma as any).actionPlan.findMany({ where: { fieldId: { in: fieldIds } }, include: { executions: true, decision: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
      (this.prisma as any).irrigationRotationRun.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      (this.prisma as any).fertigationTask.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      (this.prisma as any).dissolveFertilizerTask.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.irrigationRecord.findMany({ where: { fieldId: { in: fieldIds } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      (this.prisma as any).droneOperation.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 100 })
    ]);
    return {
      actionPlans,
      rotationRuns,
      fertigationTasks,
      dissolveTasks,
      dissolveFertilizerTasks: dissolveTasks,
      pumpOperations,
      droneOperations,
      droneMappingOperations: droneOperations.filter((item: any) => item.operationType === 'MAPPING'),
      droneSprayingOperations: droneOperations.filter((item: any) => item.operationType === 'SPRAYING'),
      droneSpreadingOperations: droneOperations.filter((item: any) => item.operationType === 'SPREADING'),
      droneScoutingOperations: droneOperations.filter((item: any) => item.operationType === 'SCOUTING')
    };
  }

  async alerts(farmId: string, user: MobileUser) {
    farmId = await this.resolveFarmId(farmId, user);
    const [safetyAlerts, anomalies] = await Promise.all([
      (this.prisma as any).safetyAlert.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      (this.prisma as any).irrigationAnomalyEvent.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' }, take: 50 })
    ]);
    return { safetyAlerts, anomalies };
  }

  async reportsSummary(farmId: string, user: MobileUser) {
    farmId = await this.resolveFarmId(farmId, user);
    const fields = await this.prisma.field.findMany({ where: { farmId } });
    const fieldIds = fields.map((item) => item.id);
    const [deviceCount, onlineDeviceCount, executions, decisions, waterUsage, fertigationTasks, pressureAnomalies, flowAnomalies, rotationRuns, droneOperations, operationCosts, cropHealth, yieldFactors] = await Promise.all([
      this.prisma.device.count({ where: { fieldId: { in: fieldIds } } }),
      this.prisma.device.count({ where: { fieldId: { in: fieldIds }, online: true } }),
      (this.prisma as any).actionExecution.findMany({ where: { actionPlan: { fieldId: { in: fieldIds } } }, take: 100 }),
      (this.prisma as any).decisionRecord.count({ where: { fieldId: { in: fieldIds } } }),
      (this.prisma as any).usageRecord.findMany({ where: { farmId, usageType: 'WATER_USAGE' }, take: 100 }),
      (this.prisma as any).fertigationTask.findMany({ where: { farmId }, take: 100 }),
      (this.prisma as any).irrigationAnomalyEvent.count({ where: { farmId, type: { in: ['PRESSURE_DROP', 'PRESSURE_TOO_HIGH'] } } }),
      (this.prisma as any).irrigationAnomalyEvent.count({ where: { farmId, type: { in: ['FLOW_TOO_LOW', 'FLOW_TOO_HIGH'] } } }),
      (this.prisma as any).irrigationRotationRun.findMany({ where: { farmId }, take: 100 }),
      (this.prisma as any).droneOperation.findMany({ where: { farmId }, take: 200 }),
      (this.prisma as any).operationCost.findMany({ where: { farmId }, take: 1000 }),
      (this.prisma as any).cropHealthObservation.findMany({ where: { farmId }, take: 1000 }),
      (this.prisma as any).yieldFactor.findMany({ where: { farmId }, take: 1000 })
    ]);
    const sprayingOperations = droneOperations.filter((item: any) => item.operationType === 'SPRAYING');
    const coverageRates = droneOperations.map((item: any) => Number(item.coverageRate)).filter((value: number) => Number.isFinite(value));
    return {
      dailyWaterUsage: 0,
      monthlyWaterUsage: 0,
      waterPerMu: 0,
      deviceOnlineRate: deviceCount ? Number(((onlineDeviceCount / deviceCount) * 100).toFixed(2)) : 0,
      actionExecutionSuccessRate: executions.length ? Number(((executions.filter((item: any) => item.status === 'PHYSICALLY_CONFIRMED').length / executions.length) * 100).toFixed(2)) : 0,
      aiAdoptionRate: decisions ? 0 : 0,
      irrigationVolumeSummary: {
        quantity: waterUsage.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
        unit: waterUsage[0]?.unit ?? 'm3'
      },
      fertigationTaskSummary: {
        total: fertigationTasks.length,
        success: fertigationTasks.filter((item: any) => item.status === 'SUCCESS').length,
        blocked: fertigationTasks.filter((item: any) => item.status === 'BLOCKED').length
      },
      pressureAnomalyCount: pressureAnomalies,
      flowAnomalyCount: flowAnomalies,
      rotationExecutionSuccessRate: rotationRuns.length ? Number(((rotationRuns.filter((item: any) => item.status === 'SUCCESS').length / rotationRuns.length) * 100).toFixed(2)) : 0,
      droneOperationCount: droneOperations.length,
      sprayingAreaTotal: Number(sprayingOperations.reduce((sum: number, item: any) => sum + Number(item.actualAreaMu ?? 0), 0).toFixed(2)),
      averageCoverageRate: this.average(coverageRates),
      chemicalUsageTotal: Number(sprayingOperations.reduce((sum: number, item: any) => sum + Number(item.sprayVolumeL ?? 0), 0).toFixed(2)),
      operationCostSummary: this.costSummary(operationCosts),
      pesticideUsageSummary: {
        sprayVolumeL: Number(sprayingOperations.reduce((sum: number, item: any) => sum + Number(item.sprayVolumeL ?? 0), 0).toFixed(2)),
        operationCount: sprayingOperations.length
      },
      droneServiceCostSummary: this.costSummary(operationCosts.filter((item: any) => item.category === 'DRONE_SERVICE')),
      cropHealthSummary: {
        total: cropHealth.length,
        byType: this.countBy(cropHealth, 'type')
      },
      yieldAnalysisSummary: {
        factorCount: yieldFactors.length,
        byFactorType: this.countBy(yieldFactors, 'factorType')
      },
      anomalyHandlingRecords: []
    };
  }

  async emergencyStop(body: { farmId?: string; fieldId?: string }, user: MobileUser) {
    const farmId = await this.resolveFarmId(body.farmId, user);
    if (body.fieldId) await this.assertFieldInTenant(body.fieldId, user, farmId);
    return this.safetyService.emergencyStop({ farmId, fieldId: body.fieldId, enabled: true });
  }

  async valve(body: { deviceId: string; command: 'VALVE_OPEN' | 'VALVE_CLOSE'; remark?: string }, user: MobileUser) {
    const device = await this.prisma.device.findFirst({ where: { id: body.deviceId, ...this.tenantWhere(user) }, include: { field: true } });
    if (!device) throw new ForbiddenException('Device is outside current tenant');
    if (user.farmId && device.field?.farmId !== user.farmId) throw new ForbiddenException('Device is outside current farm');
    if (!device.fieldId || !device.field?.farmId) throw new ForbiddenException('Device must be bound to a field and farm');
    const tenantId = user.tenantId ?? device.tenantId;
    if (!tenantId || device.tenantId !== tenantId || device.field.tenantId !== tenantId) throw new ForbiddenException('Device is outside current tenant');
    const decision = await (this.prisma as any).decisionRecord.create({ data: {
      tenantId, fieldId: device.fieldId, decisionType: 'DEVICE_HEALTH', recommendation: 'CHECK_DEVICE', confidence: 1,
      reason: `Mobile valve ${body.command} request`, status: 'PLANNED', metadata: { source: 'MOBILE', deviceId: device.id, remark: body.remark }
    } });
    const actionPlan = await (this.prisma as any).actionPlan.create({ data: {
      tenantId, decisionId: decision.id, fieldId: device.fieldId, status: 'PLANNED',
      actions: [{ type: 'DEVICE_COMMAND', deviceId: device.id, command: body.command, farmId: device.field.farmId, fieldId: device.fieldId, payload: { source: 'MOBILE', remark: body.remark } }],
      safety: { source: 'MOBILE', requiresQueue: true }
    } });
    const queueJob = await this.actionQueue().enqueue({ farmId: device.field.farmId, actionPlanId: actionPlan.id });
    return { accepted: true, queued: true, executed: false, physicalConfirmed: false, status: 'QUEUED', actionPlanId: actionPlan.id, queueJobId: queueJob.id };
  }

  private actionQueue() { return this.moduleRef.get(ActionQueueService, { strict: false }); }

  private tenantWhere(user: MobileUser) {
    return user.role === 'PLATFORM_ADMIN' ? {} : { tenantId: user.tenantId };
  }

  private async resolveFarmId(requestedFarmId: string | undefined, user: MobileUser) {
    const farmId = user.role === 'PLATFORM_ADMIN' ? requestedFarmId : user.farmId;
    if (!farmId) throw new ForbiddenException('Farm scope is required');
    if (requestedFarmId && user.role !== 'PLATFORM_ADMIN' && requestedFarmId !== farmId) {
      throw new ForbiddenException('Farm mismatch');
    }
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId, ...this.tenantWhere(user) }, select: { id: true } });
    if (!farm) throw new ForbiddenException('Farm is outside current tenant');
    return farmId;
  }

  private async assertFieldInTenant(fieldId: string, user: MobileUser, farmId?: string) {
    const field = await this.prisma.field.findFirst({ where: { id: fieldId, farmId, ...this.tenantWhere(user) }, select: { id: true } });
    if (!field) throw new ForbiddenException('Field is outside current tenant');
  }

  private average(values: number[]) {
    return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
  }

  private costSummary(items: any[]) {
    const byCategory: Record<string, number> = {};
    for (const item of items) byCategory[item.category] = Number(((byCategory[item.category] ?? 0) + Number(item.amount ?? 0)).toFixed(2));
    return {
      totalAmount: Number(items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2)),
      currency: items[0]?.currency ?? 'CNY',
      byCategory,
      count: items.length
    };
  }

  private countBy(items: any[], key: string) {
    return items.reduce((result: Record<string, number>, item: any) => {
      const value = item[key] ?? 'UNKNOWN';
      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});
  }
}
