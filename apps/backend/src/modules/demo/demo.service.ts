import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  async health(farmId = 'demo') {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    const tenantId = farm?.tenantId ?? 'demo-tenant';
    const [
      tenantExists,
      fieldsCount,
      devicesCount,
      boundariesCount,
      mapLayersCount,
      sensorRecordsCount,
      telemetrySnapshotsCount,
      irrigationDesignsCount,
      bomCount,
      hydraulicCheckCount,
      cropRecipeCount,
      wettingSimulationCount,
      rotationGroupsCount,
      fertigationTasksCount,
      droneOperationsCount,
      droneReviewsCount,
      operationReportsCount,
      operationCostsCount,
      cropHealthObservationsCount,
      yieldFactorsCount,
      farmActivitiesCount
    ] = await Promise.all([
      (this.prisma as any).tenant.count({ where: { id: tenantId } }),
      this.prisma.field.count({ where: { farmId } }),
      this.prisma.device.count({ where: { OR: [{ field: { farmId } }, { code: { startsWith: 'demo-' } }] } }),
      (this.prisma as any).fieldBoundary.count({ where: { farmId } }),
      (this.prisma as any).mapLayer.count({ where: { farmId } }),
      this.prisma.sensorRecord.count({ where: { field: { farmId } } }),
      (this.prisma as any).deviceTelemetrySnapshot.count({ where: { farmId } }),
      (this.prisma as any).irrigationDesign.count({ where: { farmId } }),
      (this.prisma as any).irrigationBOM.count({ where: { design: { farmId } } }),
      (this.prisma as any).hydraulicCheckResult.count({ where: { design: { farmId } } }),
      (this.prisma as any).cropIrrigationRecipe.count({ where: { OR: [{ tenantId }, { tenantId: null }], cropType: { in: ['洋葱', 'onion'] }, isActive: true } }),
      (this.prisma as any).wettingSimulation.count({ where: { farmId } }),
      (this.prisma as any).irrigationRotationGroup.count({ where: { farmId } }),
      (this.prisma as any).fertigationTask.count({ where: { farmId } }),
      (this.prisma as any).droneOperation.count({ where: { farmId } }),
      (this.prisma as any).droneOperationReview.count({ where: { farmId } }),
      (this.prisma as any).operationReport.count({ where: { farmId } }),
      (this.prisma as any).operationCost.count({ where: { farmId } }),
      (this.prisma as any).cropHealthObservation.count({ where: { farmId } }),
      (this.prisma as any).yieldFactor.count({ where: { farmId } }),
      (this.prisma as any).farmActivity.count({ where: { farmId } })
    ]);

    const farmExists = Boolean(farm);
    const moduleStatus = {
      tenant: this.status(tenantExists),
      farm: this.status(farmExists),
      fields: this.status(fieldsCount),
      boundaries: this.status(boundariesCount),
      mapLayers: this.status(mapLayersCount),
      devices: this.status(devicesCount),
      telemetry: this.status(telemetrySnapshotsCount),
      sensorRecords: this.status(sensorRecordsCount),
      irrigationDesign: this.status(irrigationDesignsCount),
      bom: this.status(bomCount),
      hydraulicCheck: this.status(hydraulicCheckCount),
      cropRecipe: this.status(cropRecipeCount),
      wettingSimulation: this.status(wettingSimulationCount),
      rotation: this.status(rotationGroupsCount),
      fertigation: this.status(fertigationTasksCount),
      droneOperation: this.status(droneOperationsCount),
      droneReview: this.status(droneReviewsCount),
      operationReport: this.status(operationReportsCount),
      operationCost: this.status(operationCostsCount),
      cropHealth: this.status(cropHealthObservationsCount),
      yieldFactor: this.status(yieldFactorsCount),
      farmActivity: this.status(farmActivitiesCount),
      mobileCockpit: this.status(
        Boolean(farmExists && fieldsCount > 0 && devicesCount > 0 && telemetrySnapshotsCount > 0 && rotationGroupsCount > 0 && fertigationTasksCount > 0 && farmActivitiesCount > 0)
      )
    };
    const missingItems = Object.entries(moduleStatus).filter(([, value]) => !value.ready).map(([key]) => key);
    const warnings = [
      ...(moduleStatus.mobileCockpit.ready && missingItems.length ? ['Mobile cockpit can load, but some demo modules are incomplete.'] : []),
      ...(farmExists && farmId !== 'demo' ? ['Health check is running against a non-default farmId. Demo docs use farmId=demo.'] : [])
    ];
    const recommendedActions = missingItems.length
      ? [
          'Check apps/backend/.env DATABASE_URL.',
          'Run npx prisma migrate dev --schema prisma/schema.prisma from apps/backend.',
          'Run npx prisma db seed from apps/backend.',
          'Restart backend and call /api/v1/demo/health?farmId=demo again.'
        ]
      : ['Demo farm is ready. Open mobile /cockpit, /map, /drone-operations, /drone-reviews and /reports.'];
    const isReady = missingItems.length === 0;
    const mobileCockpitReady = moduleStatus.mobileCockpit.ready;

    return {
      farmId,
      isReady,
      missingItems,
      warnings,
      recommendedActions,
      moduleStatus,
      tenantExists: tenantExists > 0,
      farmExists,
      fieldsCount,
      devicesCount,
      boundariesCount,
      mapLayersCount,
      sensorRecordsCount,
      telemetrySnapshotsCount,
      irrigationDesignsCount,
      bomCount,
      hydraulicCheckCount,
      cropRecipeCount,
      wettingSimulationCount,
      rotationGroupsCount,
      fertigationTasksCount,
      droneOperationsCount,
      droneReviewsCount,
      operationReportsCount,
      operationCostsCount,
      cropHealthObservationsCount,
      yieldFactorsCount,
      farmActivitiesCount,
      mobileCockpitReady
    };
  }

  private status(value: number | boolean) {
    const count = typeof value === 'number' ? value : value ? 1 : 0;
    return {
      ready: count > 0,
      count
    };
  }
}
