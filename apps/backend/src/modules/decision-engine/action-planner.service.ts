import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WettingSimulationService } from '../wetting-simulation/wetting-simulation.service';

@Injectable()
export class ActionPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wettingSimulationService: WettingSimulationService
  ) {}

  async createPlan(decision: any) {
    const devices = await this.prisma.device.findMany({ where: { fieldId: decision.fieldId } });
    const pump = devices.find((device) => device.type === 'PUMP');
    const valve = devices.find((device) => device.type === 'VALVE');
    const snapshot = decision.stateSnapshotId ? await (this.prisma as any).fieldStateSnapshot.findUnique({ where: { id: decision.stateSnapshotId } }) : null;
    const field = await this.prisma.field.findUnique({ where: { id: decision.fieldId } });
    const engineering = await this.buildEngineeringPreview(decision, snapshot, field);
    const actions = [];
    const safetyWarnings: string[] = [];
    const safetyBlocks: string[] = [];

    if (decision.recommendation === 'SHOULD_IRRIGATE') {
      if (pump) {
        actions.push({
          type: 'DEVICE_COMMAND',
          command: 'PUMP_ON',
          deviceId: pump.id,
          deviceCode: pump.code,
          payload: {
            wettingSimulationResult: engineering.wettingSimulationResult,
            estimatedEffect: engineering.estimatedEffect
          }
        });
      } else {
        safetyWarnings.push('No pump device is bound to this field.');
      }
      if (!valve) safetyBlocks.push('MISSING_VALVE_DEVICE');
      if (!snapshot || snapshot.soilMoisture === null || snapshot.soilMoisture === undefined) safetyWarnings.push('MISSING_MOISTURE_DATA_REQUIRES_MANUAL_APPROVAL');
      if (engineering.wettingSimulationResult?.deepPercolationRisk === 'HIGH') safetyBlocks.push('HIGH_DEEP_PERCOLATION_RISK');
      if (engineering.zoneMaxMinutes && (engineering.recommendedDuration ?? 0) > engineering.zoneMaxMinutes) safetyBlocks.push('MAX_IRRIGATION_MINUTES_PER_ZONE_EXCEEDED');
      if (engineering.maxDailyMinutes && (engineering.todayIrrigationMinutes ?? 0) >= engineering.maxDailyMinutes) safetyBlocks.push('MAX_DAILY_IRRIGATION_MINUTES_PER_FIELD_EXCEEDED');
    }

    if (decision.recommendation === 'STOP_IRRIGATION') {
      if (pump) {
        actions.push({ type: 'DEVICE_COMMAND', command: 'PUMP_OFF', deviceId: pump.id, deviceCode: pump.code });
      } else {
        safetyWarnings.push('No pump device is bound to this field.');
      }
    }

    const status = this.planStatus(actions.length, safetyWarnings, safetyBlocks);
    const plan = await (this.prisma as any).actionPlan.create({
      data: {
        decisionId: decision.id,
        fieldId: decision.fieldId,
        status,
        actions,
        safety: {
          autoExecutable: actions.length > 0 && safetyWarnings.length === 0 && safetyBlocks.length === 0,
          warnings: safetyWarnings,
          blocks: safetyBlocks,
          engineering,
          policy: 'P7 allows execution only through explicit API call or autoExecute=true.'
        }
      }
    });

    await (this.prisma as any).decisionRecord.update({
      where: { id: decision.id },
      data: {
        status: plan.status === 'SKIPPED' || plan.status === 'BLOCKED' ? 'SKIPPED' : 'PLANNED',
        metadata: {
          ...(decision.metadata ?? {}),
          actionPlanSafety: { warnings: safetyWarnings, blocks: safetyBlocks },
          note: safetyBlocks.length ? `Action plan blocked: ${safetyBlocks.join(', ')}` : undefined
        }
      }
    });

    return plan;
  }

  private planStatus(actionsLength: number, safetyWarnings: string[], safetyBlocks: string[]) {
    if (actionsLength === 0) return 'SKIPPED';
    if (safetyBlocks.length > 0) return 'BLOCKED';
    if (safetyWarnings.includes('MISSING_MOISTURE_DATA_REQUIRES_MANUAL_APPROVAL')) return 'PENDING_APPROVAL';
    return 'PLANNED';
  }

  private async buildEngineeringPreview(decision: any, snapshot: any, field: any) {
    if (decision.recommendation !== 'SHOULD_IRRIGATE') return {};
    const design = await (this.prisma as any).irrigationDesign.findFirst({
      where: { fieldId: decision.fieldId, status: { in: ['CHECKED', 'APPROVED', 'DRAFT'] } },
      include: { zones: true },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }]
    });
    const recipe = decision.metadata?.recipeId
      ? await (this.prisma as any).cropIrrigationRecipe.findUnique({ where: { id: decision.metadata.recipeId } })
      : await this.matchRecipe(decision, field);
    const recommendedDuration = Number(recipe?.recommendedIrrigationMinutes ?? 30);
    const emitterFlowRate = Number(design?.emitterFlowRate ?? 1.6);
    const cropType = String(design?.cropType ?? recipe?.cropType ?? decision.metadata?.cropName ?? 'unknown');
    const soilType = String(design?.soilType ?? field?.soilType ?? recipe?.soilType ?? 'loam');
    const wettingSimulationResult = this.wettingSimulationService.preview({
      fieldId: decision.fieldId,
      designId: design?.id,
      cropType,
      soilType,
      emitterFlowRate,
      irrigationMinutes: recommendedDuration
    });
    const todayIrrigationMinutes = await this.todayIrrigationMinutes(decision.fieldId);
    return {
      designId: design?.id,
      recipeId: recipe?.id,
      recommendedDuration,
      zoneMaxMinutes: design?.zones?.[0]?.maxIrrigationMinutes ?? null,
      maxDailyMinutes: recipe?.maxDailyIrrigationMinutes ?? null,
      todayIrrigationMinutes,
      wettingSimulationResult,
      estimatedEffect: {
        expectedMoistureIncrease: wettingSimulationResult.expectedMoistureIncrease,
        deepPercolationRisk: wettingSimulationResult.deepPercolationRisk,
        recommendedDuration: wettingSimulationResult.recommendedDuration
      }
    };
  }

  private async matchRecipe(decision: any, field: any) {
    const cropSeason = decision.cropSeasonId ? await this.prisma.cropSeason.findUnique({ where: { id: decision.cropSeasonId } }) : null;
    if (!cropSeason?.cropName) return null;
    return (this.prisma as any).cropIrrigationRecipe.findFirst({
      where: {
        cropType: cropSeason.cropName,
        cropStage: String(cropSeason.status).toLowerCase(),
        isActive: true,
        OR: [{ soilType: field?.soilType }, { soilType: null }]
      },
      orderBy: [{ soilType: 'desc' }, { createdAt: 'desc' }]
    });
  }

  private async todayIrrigationMinutes(fieldId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const records = await this.prisma.irrigationRecord.findMany({
      where: { fieldId, startTime: { gte: start }, endTime: { not: null } },
      select: { startTime: true, endTime: true }
    });
    return records.reduce((sum, record) => {
      const minutes = record.endTime ? (record.endTime.getTime() - record.startTime.getTime()) / 60000 : 0;
      return sum + Math.max(0, minutes);
    }, 0);
  }
}
