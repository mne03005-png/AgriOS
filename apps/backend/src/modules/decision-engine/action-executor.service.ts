import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { hasPermissions } from '../../common/permissions/permission-matrix';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { DeviceControlService } from '../device-control/device-control.service';
import { ExecutionResultLinkerService } from '../execution/execution-result-linker.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { SafetyService } from '../safety/safety.service';
import { ActionPlanExecutionMode } from './dto/execute-action-plan.dto';
import { isDangerousStart, isStopAction } from '@agrios/edge-core';
import { aggregatePhysicalStatus, resultExecutionStatus, TrustedPhysicalEvidence } from '../execution/physical-confirmation';

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
export class ActionExecutorService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceControlService: DeviceControlService,
    private readonly executionResultLinker: ExecutionResultLinkerService,
    private readonly operationLogService: OperationLogService,
    private readonly safetyService: SafetyService,
    private readonly requestContext: RequestContextService
  ) {}

  async onModuleInit() { await this.reconcileInterruptedDispatches(); }

  async executePlan(actionPlanId: string, execution: ActionPlanExecutionContext = {}) {
    const tenantId = execution.tenantId ?? this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Authenticated tenant context required');
    const plan = await (this.prisma as any).actionPlan.findFirst({ where: { id: actionPlanId, tenantId }, include: { decision: true } });
    if (!plan) throw new NotFoundException('Action plan not found');
    const override = execution.mode === ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE;
    if (override) this.assertAuthorizedOverride(execution.overrideReason);
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const stopOnly = actions.length > 0 && actions.every((action: any) => action.type !== 'DEVICE_COMMAND' || isStopAction(action.command));
    const safetyResult = await this.safetyService.checkActionPlan(plan, { autoExecute: true, allowDuringEmergencyStop: stopOnly });
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

    const physicalState = aggregatePhysicalStatus(executions);
    const finalStatus = physicalState === 'CONFIRMED' ? 'EXECUTED' : physicalState;
    const updatedPlan = await (this.prisma as any).actionPlan.update({
      where: { id: actionPlanId },
      data: { status: finalStatus },
      include: { executions: true, decision: true }
    });
    await (this.prisma as any).decisionRecord.update({
      where: { id: plan.decisionId },
      data: { status: finalStatus === 'EXECUTED' ? 'EXECUTED' : finalStatus === 'FAILED' ? 'FAILED' : 'AWAITING_CONFIRMATION' }
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
    if (feedback.status === 'PHYSICALLY_CONFIRMED') throw new ForbiddenException('HUMAN_PHYSICAL_CONFIRMATION_FORBIDDEN');
    await this.operationLogService.create({ action: 'ACTION_EXECUTION_DIAGNOSTIC_FEEDBACK', targetType: 'ActionExecution', targetId: executionId, description: 'Non-authoritative human diagnostic feedback', metadata: { requestedStatus: feedback.status, message: feedback.message, payload: feedback.payload, authoritative: false } as any });
    return (this.prisma as any).actionExecution.update({ where: { id: executionId }, data: { feedbackAt: new Date(), feedback: { message: feedback.message, payload: feedback.payload, authoritative: false } } });
  }

  async applyTrustedPhysicalFeedback(executionId: string, evidence: TrustedPhysicalEvidence) {
    if (!(evidence instanceof TrustedPhysicalEvidence)) throw new ForbiddenException('TRUSTED_MACHINE_EVIDENCE_REQUIRED');
    const feedback = { status: evidence.status, message: evidence.message, payload: evidence.payload };
    const tenantId = String(feedback.payload.tenantId ?? '');
    const supported = new Set(['PHYSICALLY_CONFIRMED', 'FEEDBACK_MISMATCH', 'FEEDBACK_TIMEOUT', 'OUTCOME_UNKNOWN', 'FAILED']);
    if (!feedback.status || !supported.has(feedback.status)) throw new BadRequestException('UNSUPPORTED_FEEDBACK_STATUS');
    const status = feedback.status;
    const payload = feedback.payload ?? {};
    const execution = await (this.prisma as any).actionExecution.findFirst({ where: { id: executionId, tenantId } });
    if (!execution) throw new NotFoundException('Action execution not found');
    const identity = execution.result?.identity ?? {};
    if (payload.commandId !== execution.requestId || payload.deviceId !== execution.deviceId || payload.tenantId !== tenantId || (identity.tenantId && tenantId !== identity.tenantId) || (identity.farmId && payload.farmId !== identity.farmId)) {
      throw new BadRequestException('FEEDBACK_IDENTITY_MISMATCH');
    }
    if (execution.status === 'PHYSICALLY_CONFIRMED') {
      if (feedback.status !== 'PHYSICALLY_CONFIRMED') throw new BadRequestException('TERMINAL_FEEDBACK_CONFLICT');
      return execution;
    }
    if (['FAILED', 'FEEDBACK_MISMATCH', 'FEEDBACK_TIMEOUT'].includes(execution.status)) {
      await this.operationLogService.create({ action: 'LATE_PHYSICAL_FEEDBACK', targetType: 'ActionExecution', targetId: executionId, description: 'Late physical feedback retained without changing terminal command state', metadata: { priorStatus: execution.status, feedback } as any });
      return execution;
    }
    if (status === 'PHYSICALLY_CONFIRMED') {
      const observedAt = Date.parse(String(payload.observedAt ?? ''));
      if (payload.physicalConfirmed !== true || !['MODBUS_TCP', 'FAKE_FEEDBACK'].includes(String(payload.source)) || !Number.isFinite(observedAt)
        || observedAt > Date.now() + 5000 || (execution.executedAt && observedAt < new Date(execution.executedAt).getTime())
        || payload.expectedState === undefined || payload.observedState !== payload.expectedState) {
        throw new BadRequestException('INVALID_PHYSICAL_EVIDENCE');
      }
    }
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
    await (this.prisma as any).deviceCommand.updateMany({ where: { requestId: execution.requestId }, data: { status, ackAt: new Date(), errorMessage: feedback.message } });
    const plan = await (this.prisma as any).actionExecution.findUnique({ where: { id: executionId }, select: { actionPlanId: true } });
    if (plan?.actionPlanId) {
      await this.reconcilePlan(plan.actionPlanId);
      await this.executionResultLinker.linkActionPlanResult(plan.actionPlanId);
    }
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
      data: { status: 'DISPATCHING' }
    });
    if (claimed.count !== 1) {
      return (await (this.prisma as any).actionExecution.findFirst({ where: { requestId: commandId }, orderBy: { createdAt: 'desc' } }))
        ?? { requestId: commandId, status: 'OUTCOME_UNKNOWN', duplicate: true };
    }
    const created = await (this.prisma as any).actionExecution.create({
      data: { tenantId: payload?.tenantId, actionPlanId, deviceId, command, status: 'DISPATCHING', requestId: commandId }
    });
    try {
      if (isDangerousStart(command)) {
        await this.safetyService.assertDangerousStartAllowed({ tenantId: String(payload?.tenantId ?? ''), farmId: String(payload?.farmId ?? ''), fieldId: typeof payload?.fieldId === 'string' ? payload.fieldId : undefined });
      }
      const result: any = await this.deviceControlService.send(deviceId, { command: command as SupportedCommand, payload: { ...(payload ?? {}), commandId }, controlPath: 'ACTION_QUEUE', commandId });
      const status = resultExecutionStatus(result);
      await (this.prisma as any).deviceCommand.updateMany({ where: { requestId: commandId }, data: { status, sentAt: new Date() } });
      return (this.prisma as any).actionExecution.update({
        where: { id: created.id },
        data: {
          status,
          requestId: commandId,
          result: { ...result, identity: { tenantId: payload?.tenantId, farmId: payload?.farmId, deviceId, commandId } },
          executedAt: new Date()
        }
      });
    } catch (error) {
      await (this.prisma as any).deviceCommand.updateMany({ where: { requestId: commandId }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : String(error) } }).catch(() => undefined);
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

  async reconcileInterruptedDispatches() {
    const interrupted = await (this.prisma as any).actionExecution.findMany({ where: { status: 'DISPATCHING' } });
    for (const item of interrupted) {
      await (this.prisma as any).actionExecution.update({ where: { id: item.id }, data: { status: 'OUTCOME_UNKNOWN', errorMessage: 'RESTART_DURING_DISPATCH_REQUIRES_PHYSICAL_RECONCILIATION' } });
      if (item.requestId) await (this.prisma as any).deviceCommand.updateMany({ where: { requestId: item.requestId, status: 'DISPATCHING' }, data: { status: 'OUTCOME_UNKNOWN' } });
    }
    const orphanedCommands = await (this.prisma as any).deviceCommand.findMany({ where: { status: 'DISPATCHING' } });
    for (const command of orphanedCommands) {
      await (this.prisma as any).deviceCommand.updateMany({ where: { requestId: command.requestId, status: 'DISPATCHING' }, data: { status: 'OUTCOME_UNKNOWN', errorMessage: 'RESTART_BEFORE_DISPATCH_OUTCOME_PERSISTED' } });
    }
    return interrupted.length + orphanedCommands.length;
  }

  private async reconcilePlan(actionPlanId: string) {
    const executions = await (this.prisma as any).actionExecution.findMany({ where: { actionPlanId } });
    const state = aggregatePhysicalStatus(executions);
    const status = state === 'CONFIRMED' ? 'EXECUTED' : state;
    const plan = await (this.prisma as any).actionPlan.update({ where: { id: actionPlanId }, data: { status }, include: { decision: true } });
    await (this.prisma as any).decisionRecord.update({ where: { id: plan.decisionId }, data: { status: status === 'EXECUTED' ? 'EXECUTED' : status === 'FAILED' ? 'FAILED' : 'AWAITING_CONFIRMATION' } });
    if (status === 'EXECUTED' || status === 'FAILED') {
      await (this.prisma as any).actionQueueJob?.updateMany?.({ where: { actionPlanId, status: 'AWAITING_CONFIRMATION' }, data: { status: status === 'EXECUTED' ? 'SUCCESS' : 'FAILED', finishedAt: new Date() } });
    }
  }
}
