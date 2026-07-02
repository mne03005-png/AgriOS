import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class AiRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptBuilder: PromptBuilderService
  ) {}

  async explainDecision(input: { decisionId?: string; actionPlanId?: string; fieldId?: string }) {
    const decision = await this.resolveDecision(input);
    if (!decision) throw new NotFoundException('Decision not found');
    const [snapshot, recipe, wettingSimulation, hydraulicCheck, executions] = await Promise.all([
      decision.stateSnapshotId ? (this.prisma as any).fieldStateSnapshot.findUnique({ where: { id: decision.stateSnapshotId } }) : null,
      this.findRecipe(decision),
      (this.prisma as any).wettingSimulation.findFirst({ where: { fieldId: decision.fieldId }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).hydraulicCheckResult.findFirst({ where: { design: { fieldId: decision.fieldId } }, orderBy: { createdAt: 'desc' } }),
      (this.prisma as any).actionExecution.findMany({ where: { actionPlan: { decisionId: decision.id } }, orderBy: { createdAt: 'desc' }, take: 5 })
    ]);
    const actionPlan = decision.actionPlans?.[0] ?? (await (this.prisma as any).actionPlan.findFirst({ where: { decisionId: decision.id }, orderBy: { createdAt: 'desc' } }));
    const safetyResult = actionPlan?.safety ?? {};
    const riskLevel = snapshot?.riskLevel ?? safetyResult?.engineering?.wettingSimulationResult?.deepPercolationRisk ?? 'NORMAL';
    return {
      recommendation: decision.recommendation,
      reasons: this.reasons(decision, snapshot, recipe, safetyResult),
      confidenceScore: Number(decision.confidence ?? 0.7),
      riskLevel,
      expectedWaterUsage: safetyResult?.engineering?.recommendedDuration ? Number(safetyResult.engineering.recommendedDuration) * 10 : null,
      expectedMoistureIncrease: safetyResult?.engineering?.wettingSimulationResult?.expectedMoistureIncrease ?? wettingSimulation?.resultJson?.expectedMoistureIncrease ?? null,
      safetyResult,
      wettingSimulation,
      hydraulicCheck,
      approvalRequired: actionPlan?.status === 'PENDING_APPROVAL' || actionPlan?.status === 'BLOCKED',
      suggestedActions: actionPlan?.actions ?? [],
      feedback: executions,
      promptReady: this.promptBuilder.buildDecisionPrompt({ decision, snapshot, recipe, wettingSimulation, hydraulicCheck, safetyResult })
    };
  }

  async latestByField(fieldId: string) {
    return this.explainDecision({ fieldId });
  }

  list(query: Record<string, unknown>) {
    return (this.prisma as any).aIRecommendation.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.type === 'string' ? { type: query.type } : {}),
        ...(typeof query.severity === 'string' ? { severity: query.severity } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : { status: 'ACTIVE' })
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  latest(farmId: string) {
    return (this.prisma as any).aIRecommendation.findMany({
      where: { farmId, status: 'ACTIVE' },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 10
    });
  }

  dismiss(id: string) {
    return (this.prisma as any).aIRecommendation.update({ where: { id }, data: { status: 'DISMISSED' } });
  }

  resolve(id: string) {
    return (this.prisma as any).aIRecommendation.update({ where: { id }, data: { status: 'RESOLVED' } });
  }

  private async resolveDecision(input: { decisionId?: string; actionPlanId?: string; fieldId?: string }) {
    if (input.decisionId) {
      return (this.prisma as any).decisionRecord.findUnique({ where: { id: input.decisionId }, include: { actionPlans: true } });
    }
    if (input.actionPlanId) {
      const plan = await (this.prisma as any).actionPlan.findUnique({ where: { id: input.actionPlanId } });
      if (!plan) return null;
      return (this.prisma as any).decisionRecord.findUnique({ where: { id: plan.decisionId }, include: { actionPlans: true } });
    }
    if (input.fieldId) {
      return (this.prisma as any).decisionRecord.findFirst({ where: { fieldId: input.fieldId }, include: { actionPlans: true }, orderBy: { createdAt: 'desc' } });
    }
    return null;
  }

  private async findRecipe(decision: any) {
    const cropSeason = decision.cropSeasonId ? await this.prisma.cropSeason.findUnique({ where: { id: decision.cropSeasonId }, include: { field: true } }) : null;
    if (!cropSeason) return null;
    return (this.prisma as any).cropIrrigationRecipe.findFirst({
      where: {
        cropType: cropSeason.cropName,
        cropStage: String(cropSeason.status).toLowerCase(),
        isActive: true,
        OR: [{ soilType: cropSeason.field?.soilType }, { soilType: null }]
      },
      orderBy: [{ soilType: 'desc' }, { createdAt: 'desc' }]
    });
  }

  private reasons(decision: any, snapshot: any, recipe: any, safety: any) {
    const reasons = [decision.reason].filter(Boolean);
    if (snapshot?.soilMoisture !== null && snapshot?.soilMoisture !== undefined) reasons.push(`Latest soil moisture is ${snapshot.soilMoisture}%.`);
    if (recipe) reasons.push(`Matched crop recipe ${recipe.cropType}/${recipe.cropStage} with target ${recipe.targetMoistureMin}-${recipe.targetMoistureMax}%.`);
    if (safety?.blocks?.length) reasons.push(`Safety blocks: ${safety.blocks.join(', ')}.`);
    if (safety?.warnings?.length) reasons.push(`Safety warnings: ${safety.warnings.join(', ')}.`);
    return reasons;
  }
}
