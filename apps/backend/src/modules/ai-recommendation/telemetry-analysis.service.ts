import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';
import { RecommendationExplainerService } from './recommendation-explainer.service';
import { RiskScoreService } from './risk-score.service';

@Injectable()
export class TelemetryAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
    private readonly explainer: RecommendationExplainerService,
    private readonly riskScore: RiskScoreService
  ) {}

  async analyzeFarm(farmId: string) {
    const fields = await this.prisma.field.findMany({ where: { farmId }, take: 50 });
    const results = [];
    for (const field of fields) results.push(...(await this.analyzeField(field.id)));
    return { farmId, items: results };
  }

  async analyzeField(fieldId: string) {
    const field = await this.prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) return [];
    const farmId = field.farmId;
    const [sensor, telemetry, droneOperation, operationCost, cropHealth, yieldFactor] = await Promise.all([
      this.prisma.sensorRecord.findFirst({ where: { fieldId }, orderBy: { reportedAt: 'desc' } }),
      (this.prisma as any).deviceTelemetrySnapshot.findFirst({ where: { fieldId }, orderBy: { reportedAt: 'desc' } }),
      (this.prisma as any).droneOperation.findFirst({ where: { fieldId }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).operationCost.findMany({ where: { fieldId }, take: 20 }),
      (this.prisma as any).cropHealthObservation.findFirst({ where: { fieldId }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).yieldFactor.findFirst({ where: { fieldId }, orderBy: { createdAt: 'desc' } })
    ]);

    const recommendations = [];
    const moisture = Number(sensor?.soilMoisture ?? sensor?.value);
    const moistureRisk = this.riskScore.moistureRisk(Number.isFinite(moisture) ? moisture : null);
    if (moistureRisk > 0) {
      recommendations.push(await this.upsertRecommendation({
        farmId,
        fieldId,
        type: 'IRRIGATION',
        severity: this.riskScore.scoreSeverity(moistureRisk),
        title: '土壤湿度偏低，建议人工确认灌溉',
        evidence: { soilMoisture: moisture, sensorRecordId: sensor?.id, thresholdMin: 35 },
        action: { type: 'IRRIGATION_ADVICE_ONLY', note: '仅生成建议，不自动开泵/开阀' }
      }));
    }

    if (telemetry && Number(telemetry.fertilizerTankLevelL ?? 999) < 100) {
      recommendations.push(await this.upsertRecommendation({
        farmId,
        fieldId,
        type: 'FERTIGATION',
        severity: 'MEDIUM',
        title: '肥料罐液位偏低，建议补液前复核水肥任务',
        evidence: { fertilizerTankLevelL: Number(telemetry.fertilizerTankLevelL), snapshotId: telemetry.id },
        action: { type: 'CHECK_FERTILIZER_TANK' }
      }));
    }

    if (droneOperation && Number(droneOperation.coverageRate ?? 1) < 0.9) {
      recommendations.push(await this.upsertRecommendation({
        farmId,
        fieldId,
        type: 'DRONE_COVERAGE',
        severity: 'MEDIUM',
        title: '无人机覆盖率偏低，建议复核漏喷区域',
        evidence: { coverageRate: Number(droneOperation.coverageRate), droneOperationId: droneOperation.id },
        action: { type: 'REVIEW_DRONE_OPERATION' }
      }));
    }

    const costTotal = operationCost.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
    if (costTotal > 5000) {
      recommendations.push(await this.upsertRecommendation({
        farmId,
        fieldId,
        type: 'COST_RISK',
        severity: 'LOW',
        title: '本地块投入成本较高，建议结合产量因素复盘',
        evidence: { costTotal },
        action: { type: 'REVIEW_COST_AND_YIELD_FACTORS' }
      }));
    }

    if (cropHealth) {
      recommendations.push(await this.upsertRecommendation({
        farmId,
        fieldId,
        type: 'CROP_HEALTH',
        severity: cropHealth.severity === 'HIGH' ? 'HIGH' : 'LOW',
        title: '作物健康观察已纳入风险分析',
        evidence: { cropHealthObservationId: cropHealth.id, type: cropHealth.type, severity: cropHealth.severity },
        action: { type: 'FIELD_SCOUTING_REVIEW' }
      }));
    }

    if (yieldFactor) {
      recommendations.push(await this.upsertRecommendation({
        farmId,
        fieldId,
        type: 'YIELD_FACTOR',
        severity: 'LOW',
        title: '产量影响因素已更新，建议在报表中跟踪',
        evidence: { yieldFactorId: yieldFactor.id, factorType: yieldFactor.factorType },
        action: { type: 'TRACK_YIELD_FACTOR' }
      }));
    }

    await this.audit.record({ eventType: 'ai.telemetry.analyzed', entityType: 'Field', entityId: fieldId, payload: { count: recommendations.length } });
    return recommendations;
  }

  private async upsertRecommendation(input: {
    farmId: string;
    fieldId?: string | null;
    type: string;
    severity: string;
    title: string;
    evidence: Record<string, unknown>;
    action: Record<string, unknown>;
  }) {
    const tenantId = this.requestContext.getTenantId();
    const existing = await (this.prisma as any).aIRecommendation.findFirst({
      where: { farmId: input.farmId, fieldId: input.fieldId, type: input.type, status: 'ACTIVE', title: input.title },
      orderBy: { createdAt: 'desc' }
    });
    const explained = this.explainer.build({ title: input.title, evidence: input.evidence, action: input.action });
    const data = { tenantId, ...input, ...explained, source: 'p12_rule_pipeline', confidence: 0.72 };
    if (existing) return (this.prisma as any).aIRecommendation.update({ where: { id: existing.id }, data });
    return (this.prisma as any).aIRecommendation.create({ data });
  }
}
