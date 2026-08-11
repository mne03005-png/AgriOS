import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
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
    if (businessRef.type === 'ExecutionServiceActionPlan') {
      return this.linkExecutionServicePlan(plan, payload);
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
    const decisionSource = plan.decision?.metadata?.source;
    const executionSource = actions.find((item: any) => item?.payload?.source === 'EXECUTION_SERVICE');
    if (decisionSource === 'EXECUTION_SERVICE' && executionSource) {
      return { type: 'ExecutionServiceActionPlan', record: plan };
    }
    return null;
  }

  private async linkExecutionServicePlan(plan: any, payload: any) {
    if (payload.status !== 'SUCCESS') return payload;
    const actions = (Array.isArray(plan.actions) ? plan.actions : []).filter((item: any) => item?.type === 'DEVICE_COMMAND');
    const action = actions[0];
    if (!action || !plan.tenantId) return payload;
    const usage = await this.recordUsageOnce(
      plan.tenantId,
      action.farmId ?? plan.decision?.farmId,
      action.fieldId ?? plan.fieldId,
      'DEVICE_EXECUTION',
      plan.id,
      'ActionPlan',
      action.deviceId
    );
    if (usage.created) {
      this.eventBus.publish('action.executed', {
        farmId: action.farmId ?? plan.decision?.farmId,
        fieldId: action.fieldId ?? plan.fieldId,
        deviceId: action.deviceId,
        command: action.command,
        mode: action.payload?.mode,
        actionPlanId: plan.id,
        physicalConfirmed: true
      }, plan.tenantId);
    }
    return payload;
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
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const firstPayload = actions[0]?.payload ?? {};
    let updated: any;
    let resultJson: any;
    if (payload.status === 'SUCCESS') {
      const completion = await this.completeFertigationInventory(task.id, plan, payload, firstPayload);
      if (!completion.applied) return completion.task;
      updated = completion.task;
      resultJson = updated.resultJson;
    } else {
      resultJson = {
        ...(task.resultJson ?? {}),
        durationMinutes: task.durationMinutes ?? firstPayload.durationMinutes,
        targetWaterVolume: Number(task.targetWaterVolume ?? firstPayload.targetWaterVolume ?? 0),
        targetFertilizerVolume: Number(task.targetFertilizerVolume ?? firstPayload.targetFertilizerVolume ?? 0),
        actionPlanId: plan.id,
        queueJobId: payload.queueJobId,
        physicalCompletionApplied: task.resultJson?.physicalCompletionApplied === true
      };
      updated = await (this.prisma as any).fertigationTask.update({
        where: { id: task.id },
        data: { status: payload.status, finishedAt: new Date(), resultJson }
      });
    }
    await this.upsertReport({ tenantId: task.tenantId, farmId: task.farmId, type: 'FERTIGATION', refId: task.id, title: '水肥执行报告', summaryJson: { taskId: task.id, fieldId: task.fieldId }, metricsJson: resultJson });
    if (payload.status === 'SUCCESS') {
      await this.createActivityOnce({ tenantId: task.tenantId, farmId: task.farmId, fieldId: task.fieldId, type: 'FERTIGATION_COMPLETED', title: '水肥任务完成', refType: 'FertigationTask', refId: task.id, metadata: resultJson });
      await this.recordUsageOnce(task.tenantId, task.farmId, task.fieldId, 'IRRIGATION_ACTION', task.id, 'FertigationTask');
    }
    this.eventBus.publish('execution.result.fertigation.linked', { farmId: task.farmId, fieldId: task.fieldId, taskId: task.id, status: payload.status }, task.tenantId);
    return updated;
  }

  private async completeFertigationInventory(taskId: string, plan: any, payload: any, firstPayload: any) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await (this.prisma as any).$transaction(async (tx: any) => {
          const current = await tx.fertigationTask.findUnique({ where: { id: taskId } });
          if (!current) throw new Error('Fertigation task not found during completion');
          if (current.resultJson?.physicalCompletionApplied === true) return { task: current, applied: false };
          const claimed = await tx.fertigationTask.updateMany({
            where: { id: taskId, status: { not: 'SUCCESS' } },
            data: { status: 'SUCCESS', finishedAt: new Date() }
          });
          if (claimed.count !== 1) {
            return { task: await tx.fertigationTask.findUnique({ where: { id: taskId } }), applied: false };
          }

          const rawTarget = current.targetFertilizerVolume ?? firstPayload.targetFertilizerVolume ?? 0;
          const target = this.validConsumption(rawTarget);
          const anomalies = Array.isArray(current.resultJson?.anomalies) ? [...current.resultJson.anomalies] : [];
          if (!target) anomalies.push('INVALID_TARGET_FERTILIZER_VOLUME');
          const tank = current.tankId ? await tx.fertilizerTank.findFirst({
            where: { id: current.tankId, tenantId: current.tenantId, farmId: current.farmId }
          }) : null;
          if (!current.tankId) anomalies.push('FERTILIZER_TANK_NOT_ASSIGNED');
          else if (!tank) anomalies.push('FERTILIZER_TANK_NOT_FOUND_OR_SCOPE_MISMATCH');

          let tankBeforeLevel: number | null = null;
          let tankAfterLevel: number | null = null;
          if (tank) {
            const before = new Prisma.Decimal(tank.currentLevelL ?? 0);
            const requested = target ?? new Prisma.Decimal(0);
            const decrement = requested.greaterThan(before) ? before : requested;
            const after = before.minus(decrement);
            tankBeforeLevel = before.toNumber();
            tankAfterLevel = after.toNumber();
            if (target?.greaterThan(before)) anomalies.push('INSUFFICIENT_RECORDED_FERTILIZER_STOCK');
            if (decrement.greaterThan(0)) {
              await tx.fertilizerTank.update({ where: { id: tank.id }, data: { currentLevelL: { decrement } } });
            }
          }

          const resultJson = {
            ...(current.resultJson ?? {}),
            durationMinutes: current.durationMinutes ?? firstPayload.durationMinutes,
            targetWaterVolume: Number(current.targetWaterVolume ?? firstPayload.targetWaterVolume ?? 0),
            targetFertilizerVolume: target?.toNumber() ?? null,
            tankBeforeLevel,
            tankAfterLevel,
            anomalies,
            actionPlanId: plan.id,
            queueJobId: payload.queueJobId,
            physicalCompletionApplied: true
          };
          const updated = await tx.fertigationTask.update({
            where: { id: taskId },
            data: { status: 'SUCCESS', finishedAt: new Date(), resultJson }
          });
          return { task: updated, applied: true };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 3) throw error;
      }
    }
    throw new Error('Fertigation completion transaction retry exhausted');
  }

  private validConsumption(value: unknown) {
    try {
      const decimal = new Prisma.Decimal(value as any);
      return decimal.isFinite() && !decimal.isNegative() ? decimal : null;
    } catch {
      return null;
    }
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

  private async recordUsageOnce(tenantId: string | null | undefined, farmId: string, fieldId: string | null | undefined, usageType: string, refId: string, refType: string, deviceId?: string) {
    if (!tenantId) return { record: null, created: false };
    const semanticWhere = {
      tenantId,
      usageType,
      AND: [
        { metadata: { path: ['refType'], equals: refType } as any },
        { metadata: { path: ['refId'], equals: refId } as any }
      ]
    };
    const existing = await (this.prisma as any).usageRecord.findFirst({ where: semanticWhere });
    if (existing) return { record: existing, created: false };
    const id = this.deterministicUsageId(tenantId, usageType, refType, refId);
    try {
      const record = await (this.prisma as any).usageRecord.create({
        data: { id, tenantId, farmId, fieldId, deviceId, usageType, quantity: 1, unit: 'execution', costAmount: 0, metadata: { refType, refId } }
      });
      return { record, created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const winner = await (this.prisma as any).usageRecord.findFirst({ where: semanticWhere });
      if (!winner) throw error;
      return { record: winner, created: false };
    }
  }

  private deterministicUsageId(tenantId: string, usageType: string, refType: string, refId: string) {
    const digest = createHash('sha256')
      .update(['agrios-usage-v1', tenantId, usageType, refType, refId].join('|'))
      .digest('hex');
    return `usage-${digest}`;
  }

  private sumDurationMinutes(actions: any[]) {
    return actions.reduce((sum, item) => sum + Number(item.payload?.durationMinutes ?? item.payload?.duration ?? 0), 0);
  }

  private collectExecutionMetric(executions: any[], key: string) {
    return executions.map((item) => item.result?.[key] ?? item.feedback?.payload?.[key]).filter(Boolean);
  }
}
