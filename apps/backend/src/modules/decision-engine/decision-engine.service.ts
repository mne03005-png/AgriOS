import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { ActionExecutorService } from './action-executor.service';
import { ActionPlannerService } from './action-planner.service';
import { FieldStateEngineService } from './field-state-engine.service';
import { StrategyEngineService } from './strategy-engine.service';

@Injectable()
export class DecisionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fieldStateEngine: FieldStateEngineService,
    private readonly strategyEngine: StrategyEngineService,
    private readonly actionPlanner: ActionPlannerService,
    private readonly actionExecutor: ActionExecutorService,
    private readonly operationLogService: OperationLogService
  ) {}

  async runFieldDecision(fieldId: string, input: { autoExecute?: boolean; source?: string } = {}) {
    const snapshot = await this.fieldStateEngine.build(fieldId);
    const strategy = await this.strategyEngine.evaluate(snapshot);
    const decision = await (this.prisma as any).decisionRecord.create({
      data: {
        fieldId,
        cropSeasonId: snapshot.cropSeasonId,
        stateSnapshotId: snapshot.id,
        decisionType: strategy.decisionType,
        recommendation: strategy.recommendation,
        confidence: strategy.confidence,
        reason: strategy.reason,
        metadata: {
          source: input.source ?? 'MANUAL',
          snapshotRiskLevel: snapshot.riskLevel,
          strategySource: strategy.strategySource,
          recipeId: strategy.recipe?.id
        }
      }
    });
    const actionPlan = await this.actionPlanner.createPlan(decision);
    const execution = input.autoExecute && actionPlan.status !== 'SKIPPED' ? await this.actionExecutor.executePlan(actionPlan.id) : null;

    await this.operationLogService.create({
      action: 'RUN_DECISION_ENGINE',
      targetType: 'DecisionRecord',
      targetId: decision.id,
      description: 'Run AgriOS decision engine for field',
      metadata: {
        fieldId,
        autoExecute: Boolean(input.autoExecute),
        recommendation: decision.recommendation,
        actionPlanId: actionPlan.id
      } as any
    });

    return { state: snapshot, decision, actionPlan, execution };
  }

  async findDecisions(query: Record<string, unknown> = {}) {
    const page = this.positiveInt(query.page, 1);
    const pageSize = Math.min(this.positiveInt(query.pageSize, 20), 100);
    const where = {
      ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
      ...(typeof query.status === 'string' ? { status: query.status } : {}),
      ...(typeof query.recommendation === 'string' ? { recommendation: query.recommendation } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).decisionRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { actionPlans: true }
      }),
      (this.prisma as any).decisionRecord.count({ where })
    ]);
    return { total, page, pageSize, items };
  }

  async latestFieldState(fieldId: string) {
    return (this.prisma as any).fieldStateSnapshot.findFirst({
      where: { fieldId },
      orderBy: { createdAt: 'desc' }
    });
  }

  private positiveInt(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }
}
