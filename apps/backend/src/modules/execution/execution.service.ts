import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { ActionQueueService } from '../action-queue/action-queue.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { ApprovalService } from '../approval/approval.service';
import { SafetyService } from '../safety/safety.service';
import { RunExecutionDto } from './dto/run-execution.dto';

@Injectable()
export class ExecutionService {
  constructor(
    private readonly safetyService: SafetyService,
    private readonly approvalService: ApprovalService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContext: RequestContextService,
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef
  ) {}

  async run(dto: RunExecutionDto) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Authenticated tenant context required');
    const field = await this.prisma.field.findFirst({ where: { id: dto.fieldId, tenantId }, select: { id: true, farmId: true } });
    if (!field) throw new ForbiddenException('Field is outside current tenant');
    const device = await this.prisma.device.findFirst({ where: { id: dto.deviceId, tenantId, fieldId: field.id }, select: { id: true } });
    if (!device) throw new ForbiddenException('Device is outside current field or tenant');
    const safety = await this.safetyService.check({
      fieldId: dto.fieldId,
      plannedWaterAmount: dto.plannedWaterAmount,
      durationMinutes: dto.durationMinutes,
      soilMoisture: dto.soilMoisture
    });

    if (!safety.allowed) {
      const approval = await this.approvalService.create({
        type: 'SAFETY_OVERRIDE',
        targetType: 'ExecutionRequest',
        targetId: dto.fieldId,
        reason: `Safety check did not pass: ${safety.risks.join(', ')}`
      });
      return { executed: false, queued: false, physicalConfirmed: false, mode: dto.mode, safety, approval, message: 'Safety check did not pass; manual review is required.' };
    }

    if (dto.mode === 'AUTO' && dto.command !== 'PUMP_OFF' && !this.autoModeEnabled()) {
      throw new BadRequestException('AUTO mode is disabled. Set ENABLE_AUTO_EXECUTION=true to enable guarded automation.');
    }

    const decision = await (this.prisma as any).decisionRecord.create({ data: {
      tenantId, fieldId: field.id, decisionType: 'DEVICE_HEALTH', recommendation: 'CHECK_DEVICE', confidence: 1,
      reason: `P11 ${dto.mode} execution request`, status: 'PLANNED', metadata: { source: 'EXECUTION_SERVICE', mode: dto.mode }
    } });
    const actionPlan = await (this.prisma as any).actionPlan.create({ data: {
      tenantId, decisionId: decision.id, fieldId: field.id, status: 'PLANNED',
      actions: [{ type: 'DEVICE_COMMAND', deviceId: device.id, command: dto.command, farmId: field.farmId, fieldId: field.id, payload: { source: 'EXECUTION_SERVICE', mode: dto.mode, durationMinutes: dto.durationMinutes, plannedWaterAmount: dto.plannedWaterAmount } }],
      safety: { source: 'EXECUTION_SERVICE', precheck: safety, requiresQueue: true }
    } });
    const queueJob = await this.actionQueue().enqueue({ farmId: field.farmId, actionPlanId: actionPlan.id });
    await this.operationLogService.create({
      action: 'P11_EXECUTION_QUEUED', targetType: 'ActionPlan', targetId: actionPlan.id,
      description: 'P11 execution request queued through canonical ActionPlan', metadata: { ...dto, safety, queueJobId: queueJob.id }
    });
    return { accepted: true, queued: true, executed: false, physicalConfirmed: false, status: 'QUEUED', mode: dto.mode, safety, actionPlanId: actionPlan.id, queueJobId: queueJob.id };
  }

  private actionQueue() { return this.moduleRef.get(ActionQueueService, { strict: false }); }
  private autoModeEnabled() { return process.env.ENABLE_AUTO_EXECUTION === 'true'; }
}
