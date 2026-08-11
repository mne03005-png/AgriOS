import { ForbiddenException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { ActionExecutorService } from '../decision-engine/action-executor.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ExecutionResultLinkerService } from '../execution/execution-result-linker.service';
import { BullMqQueueAdapter } from './bullmq-queue.adapter';
import { InMemoryQueueAdapter } from './in-memory-queue.adapter';
import { QueueAdapter } from './queue-adapter.interface';
import { ControlPriority, controlPriority, controlPriorityRank } from '@agrios/edge-core';

@Injectable()
export class ActionQueueService implements OnModuleDestroy {
  private readonly adapter: QueueAdapter;
  private processing = false;
  private readonly priorities = new Map<string, ControlPriority>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly actionExecutor: ActionExecutorService,
    private readonly eventBus: EventBusService,
    private readonly executionResultLinker: ExecutionResultLinkerService,
    private readonly config: ConfigService
  ) {
    this.adapter = this.createAdapter();
  }

  async enqueue(
    input: { farmId: string; actionPlanId: string; scheduledAt?: string; maxRetries?: number },
    authorizedTarget?: { tenantId: string }
  ) {
    const tenantId = await this.resolveEnqueueTenant(input.actionPlanId, input.farmId, authorizedTarget?.tenantId);
    const maxRetries = input.maxRetries ?? Number(this.config.get<string>('ACTION_QUEUE_MAX_RETRIES') ?? 3);
    const priority = await this.resolvePlanPriority(input.actionPlanId, tenantId);
    const job = await (this.prisma as any).actionQueueJob.create({
      data: {
        tenantId,
        farmId: input.farmId,
        actionPlanId: input.actionPlanId,
        status: 'QUEUED',
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        maxRetries
      }
    });
    this.priorities.set(job.id, priority);
    await this.adapter.enqueue(job.id, this.delayUntil(job.scheduledAt), priority);
    this.eventBus.publish('action.queue.queued', { farmId: input.farmId, actionPlanId: input.actionPlanId, jobId: job.id, driver: this.adapter.name }, tenantId);
    if (!this.adapter.handlesProcessing) void this.process();
    return job;
  }

  list(query: Record<string, unknown> = {}) {
    return (this.prisma as any).actionQueueJob.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async retry(id: string) {
    const job = await (this.prisma as any).actionQueueJob.update({
      where: { id },
      data: { status: 'QUEUED', lastError: null, finishedAt: null }
    });
    const priority = await this.resolvePlanPriority(job.actionPlanId, job.tenantId);
    this.priorities.set(job.id, priority);
    await this.adapter.enqueue(job.id, 0, priority);
    this.eventBus.publish('action.queue.retry', { jobId: id, actionPlanId: job.actionPlanId, farmId: job.farmId }, job.tenantId);
    if (!this.adapter.handlesProcessing) void this.process();
    return job;
  }

  async cancel(id: string) {
    const job = await (this.prisma as any).actionQueueJob.update({
      where: { id },
      data: { status: 'FAILED', lastError: 'Cancelled manually', finishedAt: new Date() }
    });
    this.eventBus.publish('action.queue.cancelled', { jobId: id, actionPlanId: job.actionPlanId, farmId: job.farmId }, job.tenantId);
    return job;
  }

  driverStatus() {
    return {
      driver: this.adapter.name,
      configuredDriver: this.config.get<string>('ACTION_QUEUE_DRIVER') ?? 'memory',
      redisConfigured: Boolean(this.config.get<string>('REDIS_URL'))
    };
  }

  async process() {
    if (this.adapter.handlesProcessing) return;
    if (this.processing) return;
    this.processing = true;
    try {
      while ((await this.adapter.size()) > 0) {
        const id = await this.adapter.next();
        if (!id) continue;
        await this.processJob(id);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processJob(id: string) {
    const job = await (this.prisma as any).actionQueueJob.findUnique({ where: { id } });
    if (!job || ['FAILED', 'SUCCESS', 'DEAD_LETTERED'].includes(job.status)) return;
    if (job.scheduledAt && new Date(job.scheduledAt).getTime() > Date.now()) {
      await this.adapter.enqueue(id, this.delayUntil(job.scheduledAt), this.priorities.get(id));
      return;
    }

    const claimed = await (this.prisma as any).actionQueueJob.updateMany({
      where: { id, status: { in: ['QUEUED', 'RETRYING'] } },
      data: { status: 'EXECUTING', startedAt: new Date() }
    });
    if (claimed.count !== 1) return;
    try {
      const plan = await this.actionExecutor.executePlan(job.actionPlanId, { tenantId: job.tenantId });
      const physicallyComplete = plan.status === 'EXECUTED';
      const updatedJob = await (this.prisma as any).actionQueueJob.update({
        where: { id },
        data: { status: physicallyComplete ? 'SUCCESS' : plan.status === 'FAILED' ? 'FAILED' : 'AWAITING_CONFIRMATION', finishedAt: physicallyComplete || plan.status === 'FAILED' ? new Date() : null, actionExecutionId: plan.executions?.[0]?.id }
      });
      await this.executionResultLinker.linkActionPlanResult(job.actionPlanId, updatedJob);
      this.eventBus.publish(physicallyComplete ? 'action.execution.completed' : 'action.execution.awaiting_confirmation', { jobId: id, actionPlanId: job.actionPlanId, farmId: job.farmId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryCount = job.retryCount + 1;
      const nextStatus = retryCount < job.maxRetries ? 'RETRYING' : 'DEAD_LETTERED';
      const updatedJob = await (this.prisma as any).actionQueueJob.update({
        where: { id },
        data: { status: nextStatus, retryCount, lastError: message, finishedAt: nextStatus === 'DEAD_LETTERED' ? new Date() : undefined }
      });
      if (nextStatus === 'DEAD_LETTERED') {
        await this.executionResultLinker.linkQueueFailure(updatedJob, message);
      }
      this.eventBus.publish(nextStatus === 'DEAD_LETTERED' ? 'deadletter.created' : 'action.execution.failed', {
        jobId: id,
        actionPlanId: job.actionPlanId,
        farmId: job.farmId,
        error: message
      });
      if (nextStatus === 'RETRYING') await this.adapter.enqueue(id, 0, this.priorities.get(id));
    }
  }

  private createAdapter(): QueueAdapter {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const configured = this.config.get<string>('ACTION_QUEUE_DRIVER') ?? (redisUrl ? 'bullmq' : 'memory');
    if (configured === 'bullmq' && redisUrl) {
      try {
        return new BullMqQueueAdapter(redisUrl, (jobId) => this.processJob(jobId));
      } catch (error) {
        console.warn(error instanceof Error ? error.message : String(error));
      }
    }
    return new InMemoryQueueAdapter(() => void this.process());
  }

  private delayUntil(value?: Date | string | null) {
    return value ? Math.max(0, new Date(value).getTime() - Date.now()) : 0;
  }

  private async resolvePlanPriority(actionPlanId: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Resolved tenant is required for action queue');
    const plan = await (this.prisma as any).actionPlan.findFirst({ where: { id: actionPlanId, tenantId }, select: { actions: true } });
    if (!plan) throw new NotFoundException('Action plan not found in current tenant');
    const actions = Array.isArray(plan?.actions) ? plan.actions : [];
    return actions.reduce((selected: ControlPriority, action: any) => {
      const next = action?.type === 'DEVICE_COMMAND' ? controlPriority(String(action.command ?? '')) : ControlPriority.NORMAL_CONTROL;
      return controlPriorityRank(next) < controlPriorityRank(selected) ? next : selected;
    }, ControlPriority.NORMAL_CONTROL);
  }

  private async resolveEnqueueTenant(actionPlanId: string, farmId: string, authorizedTargetTenant?: string) {
    const contextTenant = this.requestContext.getTenantId();
    if (authorizedTargetTenant && contextTenant && authorizedTargetTenant !== contextTenant && !this.requestContext.isPlatformAdmin()) {
      throw new ForbiddenException('Normal tenant cannot override action queue tenant');
    }
    const tenantId = authorizedTargetTenant ?? contextTenant;
    if (!tenantId) throw new ForbiddenException('Resolved tenant is required for action queue');
    const [plan, farm] = await Promise.all([
      (this.prisma as any).actionPlan.findFirst({ where: { id: actionPlanId, tenantId }, select: { id: true } }),
      (this.prisma as any).farm.findFirst({ where: { id: farmId, tenantId }, select: { id: true } })
    ]);
    if (!plan) throw new NotFoundException('Action plan not found in resolved tenant');
    if (!farm) throw new NotFoundException('Farm not found in resolved tenant');
    return tenantId;
  }

  async onModuleDestroy() {
    await this.adapter.close?.();
  }
}
