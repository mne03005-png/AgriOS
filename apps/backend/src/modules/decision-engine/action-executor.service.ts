import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { hasPermissions } from '../../common/permissions/permission-matrix';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { DeviceControlService } from '../device-control/device-control.service';
import { ExecutionResultLinkerService } from '../execution/execution-result-linker.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { SafetyService } from '../safety/safety.service';
import { ActionPlanExecutionMode } from './dto/execute-action-plan.dto';

interface ActionPlanExecutionContext {
  mode?: ActionPlanExecutionMode;
  overrideReason?: string;
  tenantId?: string;
}

type SupportedCommand =
  | 'PUMP_ON'
  | 'PUMP_OFF'
  | 'VALVE_OPEN'
  | 'VALVE_CLOSE'
  | 'SET_VALVE_OPENING'
  | 'SET_PUMP_FREQUENCY'
  | 'START_FERTIGATION'
  | 'STOP_FERTIGATION'
  | 'START_DISSOLVING'
  | 'STOP_DISSOLVING';

@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceControlService: DeviceControlService,
    private readonly executionResultLinker: ExecutionResultLinkerService,
    private readonly operationLogService: OperationLogService,
    private readonly safetyService: SafetyService,
    private readonly requestContext: RequestContextService
  ) {}

  async executePlan(actionPlanId: string, execution: ActionPlanExecutionContext = {}) {
    const tenantId = execution.tenantId ?? this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Authenticated tenant context required');
    const plan = await (this.prisma as any).actionPlan.findFirst({ where: { id: actionPlanId, tenantId }, include: { decision: true } });
    if (!plan) throw new NotFoundException('Action plan not found');
    const override = execution.mode === ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE;
    if (override) this.assertAuthorizedOverride(execution.overrideReason);
    const safetyResult = await this.safetyService.checkActionPlan(plan, { autoExecute: true });
    if (safetyResult.hardBlocks.length > 0) {
      throw new BadRequestException(`Action plan blocked by safety policy: ${safetyResult.status}`);
    }
    if (!safetyResult.allowed && !override) {
      throw new BadRequestException(`Action plan blocked by safety policy: ${safetyResult.status}`);
    }
    if (plan.status === 'BLOCKED') {
      throw new BadRequestException('Action plan status is BLOCKED and cannot be overridden');
    }
    if (plan.status === 'PENDING_APPROVAL' && !override) {
      throw new BadRequestException('Action plan requires approval or an authorized policy override');
    }
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    if (actions.length === 0) {
      throw new BadRequestException('Action plan has no executable actions');
    }

    await (this.prisma as any).actionPlan.update({ where: { id: actionPlanId }, data: { status: 'EXECUTING' } });
    const executions = [];
    for (const action of actions) {
      if (action.type !== 'DEVICE_COMMAND' || !action.deviceId || !action.command) continue;
      const execution = await this.executeDeviceCommand(actionPlanId, action.deviceId, action.command, {
        ...(action.payload ?? {}),
        tenantId: plan.tenantId,
        farmId: action.farmId ?? plan.decision?.farmId ?? '',
        fieldId: action.fieldId ?? plan.fieldId,
        zoneId: action.zoneId,
        requestedAt: action.requestedAt ?? new Date().toISOString(),
        expiresAt: action.expiresAt ?? new Date(Date.now() + 5 * 60_000).toISOString()
      }, action.commandId);
      executions.push(execution);
    }

    const finalStatus = executions.some((item) => item.status === 'FAILED') ? 'FAILED' : 'EXECUTED';
    const updatedPlan = await (this.prisma as any).actionPlan.update({
      where: { id: actionPlanId },
      data: { status: finalStatus },
      include: { executions: true, decision: true }
    });
    await (this.prisma as any).decisionRecord.update({
      where: { id: plan.decisionId },
      data: { status: finalStatus === 'EXECUTED' ? 'EXECUTED' : 'FAILED' }
    });

    await this.operationLogService.create({
      action: 'EXECUTE_DECISION_ACTION_PLAN',
      targetType: 'ActionPlan',
      targetId: actionPlanId,
      description: 'Execute decision action plan',
      metadata: {
        finalStatus,
        executionCount: executions.length,
        override: override ? {
          type: ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE,
          reason: execution.overrideReason,
          userId: this.requestContext.getUserId(),
          tenantId,
          requestId: this.requestContext.getRequestId(),
          timestamp: new Date().toISOString()
        } : undefined
      } as any
    });

    await this.executionResultLinker.linkActionPlanResult(actionPlanId);

    return updatedPlan;
  }

  async feedback(executionId: string, feedback: { status?: string; message?: string; payload?: Record<string, unknown> }) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Authenticated tenant context required');
    const execution = await (this.prisma as any).actionExecution.findFirst({ where: { id: executionId, actionPlan: { tenantId } } });
    if (!execution) throw new NotFoundException('Action execution not found');
    const status = feedback.status === 'FAILED' ? 'FAILED' : feedback.status === 'SKIPPED' ? 'SKIPPED' : 'ACKED';
    const updated = await (this.prisma as any).actionExecution.update({
      where: { id: executionId },
      data: {
        status,
        feedbackAt: new Date(),
        feedback: {
          message: feedback.message,
          payload: feedback.payload
        }
      }
    });
    const plan = await (this.prisma as any).actionExecution.findUnique({ where: { id: executionId }, select: { actionPlanId: true } });
    if (plan?.actionPlanId) await this.executionResultLinker.linkActionPlanResult(plan.actionPlanId);
    return updated;
  }

  private assertAuthorizedOverride(reason?: string) {
    if (!reason?.trim()) throw new BadRequestException('Override reason is required');
    if (!hasPermissions(this.requestContext.getRole(), [PERMISSIONS.ACTION_POLICY_OVERRIDE])) {
      throw new ForbiddenException('Elevated policy override permission required');
    }
  }

  private async executeDeviceCommand(actionPlanId: string, deviceId: string, command: string, payload?: Record<string, unknown>, existingCommandId?: string) {
    // Stable across queue retries: a retried ActionPlan cannot create a second physical command identity.
    const commandId = existingCommandId ?? `${actionPlanId}:${deviceId}:${command}`;
    const previous = await (this.prisma as any).actionExecution.findFirst({ where: { requestId: commandId }, orderBy: { createdAt: 'desc' } });
    if (previous) return previous;
    await (this.prisma as any).deviceCommand.upsert({
      where: { requestId: commandId },
      create: {
        tenantId: payload?.tenantId,
        deviceId,
        command,
        payload: { ...(payload ?? {}), commandId },
        status: 'PENDING',
        mqttTopic: `agrios/device/${deviceId}/command`,
        requestId: commandId
      },
      update: {}
    });
    const claimed = await (this.prisma as any).deviceCommand.updateMany({
      where: { requestId: commandId, status: 'PENDING' },
      data: { status: 'SENT', sentAt: new Date() }
    });
    if (claimed.count !== 1) {
      return (await (this.prisma as any).actionExecution.findFirst({ where: { requestId: commandId }, orderBy: { createdAt: 'desc' } }))
        ?? { requestId: commandId, status: 'SENT', duplicate: true };
    }
    const created = await (this.prisma as any).actionExecution.create({
      data: { actionPlanId, deviceId, command, status: 'PENDING', requestId: commandId }
    });
    try {
      const result: any = await this.deviceControlService.send(deviceId, { command: command as SupportedCommand, payload: { ...(payload ?? {}), commandId }, controlPath: 'ACTION_QUEUE', commandId });
      return (this.prisma as any).actionExecution.update({
        where: { id: created.id },
        data: {
          status: 'SENT',
          requestId: commandId,
          result,
          executedAt: new Date()
        }
      });
    } catch (error) {
      return (this.prisma as any).actionExecution.update({
        where: { id: created.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          executedAt: new Date()
        }
      });
    }
  }
}
