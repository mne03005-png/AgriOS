import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { aggregatePhysicalStatus } from './physical-confirmation';

@Injectable()
export class ExecutionResultLinkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService
  ) {}

  async linkActionPlanResult(actionPlanId: string, queueJob?: any) {
    const plan = await (this.prisma as any).actionPlan.findUnique({
      where: { id: actionPlanId },
      include: { executions: true, decision: true }
    });
    if (!plan) return null;
    const executions = plan.executions ?? [];
    const failed = executions.filter((item: any) => ['FAILED', 'FEEDBACK_MISMATCH', 'FEEDBACK_TIMEOUT'].includes(item.status));
    const success = executions.filter((item: any) => item.status === 'PHYSICALLY_CONFIRMED');
    const businessRef = await this.resolveBusinessRef(plan);
    if (!businessRef) return null;
    const physicalState = aggregatePhysicalStatus(executions);
    const status = failed.length > 0 || plan.status === 'FAILED' ? 'FAILED' : physicalState === 'CONFIRMED' ? 'SUCCESS' : 'AWAITING_CONFIRMATION';
    const payload = {
      actionPlanId,
      queueJobId: queueJob?.id,
      executionCount: executions.length,
      successCount: success.length,
      failedCount: failed.length,
      status,
      executions
    };

    if (status === 'AWAITING_CONFIRMATION') return payload;

    if (businessRef.type === 'IrrigationRotationRun') {
      return this.linkRotationRun(businessRef.record, plan, payload);
    }
    if (businessRef.type === 'FertigationTask') {
      return this.linkFertigationTask(businessRef.record, plan, payload);
    }
    if (businessRef.type === 'DissolveFertilizerTask') {
      return this.linkDissolveTask(businessRef.record, plan, payload);
    }
    return null;
  }

  async linkQueueFailure(job: any, errorMessage: string) {
    const plan = job?.actionPlanId
      ? await (this.prisma as any).actionPlan.findUnique({ where: { id: job.actionPlanId }, include: { executions: true, decision: true } })
      : null;
    if (!plan) return null;
    const businessRef = await this.resolveBusinessRef(plan);
    if (!businessRef) return null;
    const resultJson = { actionPlanId: plan.id, queueJobId: job.id, status: 'FAILED', errorMessage };
    if (businessRef.type === 'IrrigationRotationRun') {
      await (this.prisma as any).irrigationRotationRun.update({ where: { id: businessRef.record.id }, data: { status: 'FAILED', finishedAt: new Date(), resultJson } });
      await this.upsertReport({ tenantId: businessRef.record.tenantId, farmId: businessRef.record.farmId, type: 'ROTATION', refId: businessRef.record.id, title: '轮灌执行失败报告', metricsJson: resultJson, summaryJson: resultJson });
    }
    if (businessRef.type === 'FertigationTask') {
      await (this.prisma as any).fertigationTask.update({ where: { id: businessRef.record.id }, data: { status: 'FAILED', finishedAt: new Date(), resultJson } });
      await this.upsertReport({ tenantId: businessRef.record.tenantId, farmId: businessRef.record.farmId, type: 'FERTIGATION', refId: businessRef.record.id, title: '水肥执行失败报告', metricsJson: resultJson, summaryJson: resultJson });
    }
    this.eventBus.publish('execution.result.linked.failed', { farmId: businessRef.record.farmId, entityType: businessRef.type, entityId: businessRef.record.id, actionPlanId: plan.id }, businessRef.record.tenantId);
    return resultJson;
  }

  private async resolveBusinessRef(plan: any) {
    const rotationRun = await (this.prisma as any).irrigationRotationRun.findFirst({ where: { actionPlanId: plan.id } });
    if (rotationRun) return { type: 'IrrigationRotationRun', record: rotationRun };
    const fertigationTask = await (this.prisma as any).fertigationTask.findFirst({ where: { actionPlanId: plan.id } });
    if (fertigationTask) return { type: 'FertigationTask', record: fertigationTask };
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const dissolveTaskId = actions.map((item: any) => item.payload?.taskId).find((value: unknown) => typeof value === 'string');
    if (dissolveTaskId) {
      const dissolveTask = await (this.prisma as any).dissolveFertilizerTask.findUnique({ where: { id: dissolveTaskId } });
      if (dissolveTask) return { type: 'DissolveFertilizerTask', record: dissolveTask };
    }
    return null;
  }

  private async linkRotationRun(run: any, plan: any, payload: any) {
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const durationMinutes = this.sumDurationMinutes(actions);
    const resultJson = {
      ...(run.resultJson ?? {}),
      totalValves: actions.filter((item: any) => item.command?.includes('VALVE')).length || actions.length,
      successValves: payload.successCount,
      failedValves: payload.failedCount,
      durationMinutes,
      pressureSummary: this.collectExecutionMetric(payload.executions, 'pressureSummary'),
      flowSummary: this.collectExecutionMetric(payload.executions, 'flowSummary'),
      actionPlanId: plan.id,
      queueJobId: payload.queueJobId
    };
    const updated = await (this.prisma as any).irrigationRotationRun.update({
      where: { id: run.id },
      data: { status: payload.status, finishedAt: new Date(), resultJson }
    });
    await this.upsertReport({ tenantId: run.tenantId, farmId: run.farmId, type: 'ROTATION', refId: run.id, title: '轮灌执行报告', summaryJson: { runId: run.id, fieldId: plan.fieldId }, metricsJson: resultJson });
    if (payload.status === 'SUCCESS') {
      await this.createActivityOnce({ tenantId: run.tenantId, farmId: run.farmId, fieldId: plan.fieldId, type: 'ROTATION_COMPLETED', title: '轮灌执行完成', refType: 'IrrigationRotationRun', refId: run.id, metadata: resultJson });
      await this.recordUsageOnce(run.tenantId, run.farmId, plan.fieldId, 'IRRIGATION_ACTION', run.id, 'IrrigationRotationRun');
    }
    this.eventBus.publish('execution.result.rotation.linked', { farmId: run.farmId, fieldId: plan.fieldId, runId: run.id, status: payload.status }, run.tenantId);
    return updated;
  }

  private async linkFertigationTask(task: any, plan: any, payload: any) {
    if (payload.status === 'SUCCESS') {
      const claim = await (this.prisma as any).fertigationTask.updateMany({ where: { id: task.id, status: { not: 'SUCCESS' } }, data: { status: 'SUCCESS', finishedAt: new Date() } });
      if (claim.count !== 1) return (this.prisma as any).fertigationTask.findUnique({ where: { id: task.id } });
    }
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const firstPayload = actions[0]?.payload ?? {};
    const tank = task.tankId ? await (this.prisma as any).fertilizerTank.findUnique({ where: { id: task.tankId } }) : null;
    const targetFertilizerVolume = Number(task.targetFertilizerVolume ?? firstPayload.targetFertilizerVolume ?? 0);
    const tankBeforeLevel = Number(tank?.currentLevelL ?? 0);
    const tankAfterLevel = tank ? Math.max(tankBeforeLevel - targetFertilizerVolume, 0) : null;
    const completionAlreadyApplied = task.resultJson?.physicalCompletionApplied === true;
    if (tank && payload.status === 'SUCCESS' && !completionAlreadyApplied) {
      await (this.prisma as any).fertilizerTank.update({ where: { id: tank.id }, data: { currentLevelL: tankAfterLevel } });
    }
    const resultJson = {
      ...(task.resultJson ?? {}),
      durationMinutes: task.durationMinutes ?? firstPayload.durationMinutes,
      targetWaterVolume: Number(task.targetWaterVolume ?? firstPayload.targetWaterVolume ?? 0),
      targetFertilizerVolume,
      tankBeforeLevel,
      tankAfterLevel,
      anomalies: [],
      actionPlanId: plan.id,
      queueJobId: payload.queueJobId,
      physicalCompletionApplied: payload.status === 'SUCCESS' || completionAlreadyApplied
    };
    const updated = await (this.prisma as any).fertigationTask.update({
      where: { id: task.id },
      data: { status: payload.status, finishedAt: new Date(), resultJson }
    });
    await this.upsertReport({ tenantId: task.tenantId, farmId: task.farmId, type: 'FERTIGATION', refId: task.id, title: '水肥执行报告', summaryJson: { taskId: task.id, fieldId: task.fieldId }, metricsJson: resultJson });
    if (payload.status === 'SUCCESS') {
      await this.createActivityOnce({ tenantId: task.tenantId, farmId: task.farmId, fieldId: task.fieldId, type: 'FERTIGATION_COMPLETED', title: '水肥任务完成', refType: 'FertigationTask', refId: task.id, metadata: resultJson });
      await this.recordUsageOnce(task.tenantId, task.farmId, task.fieldId, 'IRRIGATION_ACTION', task.id, 'FertigationTask');
    }
    this.eventBus.publish('execution.result.fertigation.linked', { farmId: task.farmId, fieldId: task.fieldId, taskId: task.id, status: payload.status }, task.tenantId);
    return updated;
  }

  private async linkDissolveTask(task: any, plan: any, payload: any) {
    const resultJson = {
      ...(task.resultJson ?? {}),
      waterVolumeL: Number(task.waterVolumeL ?? 0),
      fertilizerWeightKg: Number(task.fertilizerWeightKg ?? 0),
      durationMinutes: task.durationMinutes,
      actionPlanId: plan.id,
      queueJobId: payload.queueJobId
    };
    const updated = await (this.prisma as any).dissolveFertilizerTask.update({
      where: { id: task.id },
      data: { status: payload.status, finishedAt: new Date(), resultJson }
    });
    this.eventBus.publish('execution.result.dissolve.linked', { farmId: task.farmId, taskId: task.id, status: payload.status }, task.tenantId);
    return updated;
  }

  private async upsertReport(input: { tenantId?: string | null; farmId: string; type: string; refId: string; title: string; summaryJson: any; metricsJson: any }) {
    const existing = await (this.prisma as any).operationReport.findFirst({ where: { type: input.type, refId: input.refId }, orderBy: { createdAt: 'desc' } });
    if (existing) {
      return (this.prisma as any).operationReport.update({ where: { id: existing.id }, data: { title: input.title, summaryJson: input.summaryJson, metricsJson: input.metricsJson } });
    }
    return (this.prisma as any).operationReport.create({ data: input });
  }

  private async createActivityOnce(input: { tenantId?: string | null; farmId: string; fieldId?: string | null; type: string; title: string; refType: string; refId: string; metadata?: any }) {
    const existing = await (this.prisma as any).farmActivity.findFirst({ where: { type: input.type, refType: input.refType, refId: input.refId } });
    if (existing) return existing;
    return (this.prisma as any).farmActivity.create({ data: input });
  }

  private async recordUsageOnce(tenantId: string | null | undefined, farmId: string, fieldId: string | null | undefined, usageType: string, refId: string, refType: string) {
    if (!tenantId) return null;
    const existing = await (this.prisma as any).usageRecord.findFirst({
      where: { tenantId, usageType, metadata: { path: ['refId'], equals: refId } as any }
    }).catch(() => null);
    if (existing) return existing;
    return (this.prisma as any).usageRecord.create({
      data: { tenantId, farmId, fieldId, usageType, quantity: 1, unit: 'execution', costAmount: 0, metadata: { refType, refId } }
    });
  }

  private sumDurationMinutes(actions: any[]) {
    return actions.reduce((sum, item) => sum + Number(item.payload?.durationMinutes ?? item.payload?.duration ?? 0), 0);
  }

  private collectExecutionMetric(executions: any[], key: string) {
    return executions.map((item) => item.result?.[key] ?? item.feedback?.payload?.[key]).filter(Boolean);
  }
}
