import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceControlService } from '../device-control/device-control.service';
import { ExecutionResultLinkerService } from '../execution/execution-result-linker.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { SafetyService } from '../safety/safety.service';

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
    private readonly safetyService: SafetyService
  ) {}

  async executePlan(actionPlanId: string, force = false) {
    const plan = await (this.prisma as any).actionPlan.findUnique({ where: { id: actionPlanId }, include: { decision: true } });
    if (!plan) throw new NotFoundException('Action plan not found');
    const safetyResult = await this.safetyService.checkActionPlan(plan, { autoExecute: !force });
    if (!force && !safetyResult.allowed) {
      throw new BadRequestException(`Action plan blocked by safety policy: ${safetyResult.status}`);
    }
    if (!force && (plan.status === 'BLOCKED' || plan.status === 'PENDING_APPROVAL')) {
      throw new BadRequestException(`Action plan status is ${plan.status}; manual approval or force is required.`);
    }
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    if (actions.length === 0 && !force) {
      throw new BadRequestException('Action plan has no executable actions');
    }

    await (this.prisma as any).actionPlan.update({ where: { id: actionPlanId }, data: { status: 'EXECUTING' } });
    const executions = [];
    for (const action of actions) {
      if (action.type !== 'DEVICE_COMMAND' || !action.deviceId || !action.command) continue;
      const execution = await this.executeDeviceCommand(actionPlanId, action.deviceId, action.command, action.payload);
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
      metadata: { finalStatus, executionCount: executions.length } as any
    });

    await this.executionResultLinker.linkActionPlanResult(actionPlanId);

    return updatedPlan;
  }

  async feedback(executionId: string, feedback: { status?: string; message?: string; payload?: Record<string, unknown> }) {
    const execution = await (this.prisma as any).actionExecution.findUnique({ where: { id: executionId } });
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

  private async executeDeviceCommand(actionPlanId: string, deviceId: string, command: string, payload?: Record<string, unknown>) {
    const created = await (this.prisma as any).actionExecution.create({
      data: { actionPlanId, deviceId, command, status: 'PENDING' }
    });
    try {
      const result: any = await this.deviceControlService.send(deviceId, { command: command as SupportedCommand, payload });
      return (this.prisma as any).actionExecution.update({
        where: { id: created.id },
        data: {
          status: 'SENT',
          requestId: result.deviceCommand?.requestId,
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
