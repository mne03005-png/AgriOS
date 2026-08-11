import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DeviceControlService } from './device-control.service';
import {
  ValveAckStatus,
  ValveCommandAck,
  ValveCommandRequest,
  ValveCommandType,
  ValveDryRunDto,
  ValveFeedbackDto
} from './protocols/valve-control.protocol';

type ValveCommandOptions = {
  commandType: ValveCommandType;
  openingPercent?: number;
  testDurationSeconds?: number;
  dryRun?: boolean;
};

@Injectable()
export class ValveControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly deviceControl: DeviceControlService
  ) {}

  requestOpenValve(deviceId: string, dto: ValveDryRunDto = {}) {
    return this.requestValveCommand(deviceId, { commandType: 'OPEN', dryRun: dto.dryRun });
  }

  requestCloseValve(deviceId: string, dto: ValveDryRunDto = {}) {
    return this.requestValveCommand(deviceId, { commandType: 'CLOSE', dryRun: dto.dryRun });
  }

  requestSetValveOpening(deviceId: string, openingPercent: number, dryRun?: boolean) {
    return this.requestValveCommand(deviceId, { commandType: 'SET_OPENING', openingPercent, dryRun });
  }

  requestTestOpen(deviceId: string, testDurationSeconds?: number, dryRun?: boolean) {
    return this.requestValveCommand(deviceId, { commandType: 'TEST_OPEN', testDurationSeconds, dryRun });
  }

  async getValveStatus(deviceId: string) {
    const device = await this.findValveDevice(deviceId);
    if (!device) throw new NotFoundException('Valve device not found');
    const latestCommand = await (this.prisma as any).deviceCommand.findFirst({ where: { deviceId }, orderBy: { createdAt: 'desc' } });
    const latestExecution = latestCommand
      ? await (this.prisma as any).actionExecution.findFirst({ where: { requestId: latestCommand.requestId }, orderBy: { createdAt: 'desc' } })
      : null;
    const currentStatus = this.objectValue(device.currentStatus);
    return {
      deviceId,
      deviceCode: device.code,
      deviceType: device.type,
      online: Boolean(device.online),
      valveStatus: currentStatus.valveStatus ?? 'UNKNOWN',
      valveOpeningPercent: currentStatus.valveOpeningPercent ?? 0,
      latestCommand,
      latestExecution,
      dryRun: this.valveDryRun(),
      realControlAllowed: this.valveRealControlAllowed(),
      feedbackRequired: this.valveFeedbackRequired()
    };
  }

  listCommands(deviceId: string) {
    return (this.prisma as any).deviceCommand.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async handleValveTelemetryFeedback(dto: ValveFeedbackDto) {
    const status: ValveAckStatus = dto.success ? 'ACKED' : 'FAILED';
    return this.handleValveAck({
      commandId: dto.commandId,
      deviceId: dto.deviceId ?? '',
      accepted: dto.success,
      status,
      valveStatus: dto.valveStatus,
      valveOpeningPercent: dto.valveOpeningPercent,
      errorCode: dto.errorCode ?? undefined,
      errorMessage: dto.errorMessage ?? undefined,
      timestamp: dto.timestamp ?? new Date().toISOString()
    });
  }

  async handleValveAck(ack: ValveCommandAck) {
    const command = await (this.prisma as any).deviceCommand.findUnique({ where: { requestId: ack.commandId }, include: { device: true } });
    if (!command) {
      await this.recordValveEvent('valve.feedback.dead_letter', 'WARNING', undefined, {
        commandId: ack.commandId,
        reason: 'COMMAND_NOT_FOUND',
        ack
      });
      await this.audit.record({
        eventType: 'valve.feedback.dead_letter',
        severity: 'WARNING',
        payload: { commandId: ack.commandId, reason: 'COMMAND_NOT_FOUND', ack }
      });
      return { accepted: false, deadLetter: true, errorCode: 'COMMAND_NOT_FOUND' };
    }

    if (['ACKED', 'FAILED', 'TIMEOUT'].includes(command.status) && command.ackAt) {
      return { accepted: true, duplicate: true, command };
    }

    const nextStatus = ack.status === 'TIMEOUT' ? 'TIMEOUT' : ack.accepted && ack.status !== 'FAILED' ? 'ACKED' : 'FAILED';
    const updated = await (this.prisma as any).deviceCommand.update({
      where: { id: command.id },
      data: {
        status: nextStatus,
        ackAt: new Date(ack.timestamp),
        errorMessage: ack.errorMessage,
        payload: {
          ...this.objectValue(command.payload),
          ack
        }
      }
    });

    // Protocol ACK proves receipt/software handling only. Physical completion is reconciled separately.
    const executionStatus = nextStatus === 'ACKED' ? 'FEEDBACK_PENDING' : 'FAILED';
    await (this.prisma as any).actionExecution.updateMany({
      where: { requestId: ack.commandId },
      data: {
        status: executionStatus,
        feedbackAt: new Date(ack.timestamp),
        feedback: ack as any,
        errorMessage: ack.errorMessage
      }
    });

    const currentStatus = this.objectValue(command.device?.currentStatus);
    await (this.prisma as any).device.update({
      where: { id: command.deviceId },
      data: {
        currentStatus: {
          ...currentStatus,
          valveStatus: ack.valveStatus ?? currentStatus.valveStatus ?? 'UNKNOWN',
          valveOpeningPercent: ack.valveOpeningPercent ?? currentStatus.valveOpeningPercent ?? 0,
          lastCommandId: ack.commandId,
          lastCommandStatus: ack.status,
          lastValveAckAt: ack.timestamp,
          valveErrorCode: ack.errorCode
        },
        lastReportedAt: new Date(ack.timestamp)
      }
    });

    await this.recordValveEvent(nextStatus === 'ACKED' ? 'valve.command.acked' : 'valve.command.failed', nextStatus === 'ACKED' ? 'INFO' : 'WARNING', command.deviceId, {
      commandId: ack.commandId,
      status: nextStatus,
      ack
    });
    return { accepted: true, duplicate: false, command: updated, status: nextStatus };
  }

  async requestValveCommand(deviceId: string, options: ValveCommandOptions) {
    const device = await this.findValveDevice(deviceId);
    if (!device) throw new NotFoundException('Valve device not found');

    const dryRun = options.dryRun ?? this.valveDryRun();
    const safety = await this.checkValveSafety(device, options, dryRun);
    if (!safety.allowed) {
      await this.audit.record({
        eventType: 'valve.command.blocked',
        severity: 'WARNING',
        entityType: 'Device',
        entityId: deviceId,
        payload: { errorCode: safety.errorCode, reasons: safety.reasons, commandType: options.commandType, dryRun }
      });
      throw new ForbiddenException({ errorCode: safety.errorCode, reasons: safety.reasons });
    }

    const commandId = `valve-${randomUUID()}`;
    const timeoutMs = this.valveCommandTimeoutMs();
    const request: ValveCommandRequest = {
      commandId,
      tenantId: device.tenantId ?? this.requestContext.getTenantId() ?? 'demo',
      farmId: device.field.farmId,
      fieldId: device.fieldId,
      deviceId: device.id,
      deviceCode: device.code,
      commandType: options.commandType,
      openingPercent: options.openingPercent,
      testDurationSeconds: options.testDurationSeconds,
      requestedBy: this.requestContext.getUserId() ?? 'demo-user',
      dryRun,
      requestedAt: new Date().toISOString(),
      timeoutMs
    };

    const decision = await this.createValveDecision(device, request);
    const actionPlan = await this.createValveActionPlan(device, decision.id, request, safety);
    const approval = await this.createDryRunApproval(device, actionPlan.id, decision.id, request);
    const queueJob = await (this.prisma as any).actionQueueJob.create({
      data: {
        tenantId: request.tenantId,
        farmId: request.farmId,
        actionPlanId: actionPlan.id,
        status: 'QUEUED',
        maxRetries: 0
      }
    });
    const deviceCommand = await (this.prisma as any).deviceCommand.create({
      data: {
        tenantId: request.tenantId,
        deviceId: device.id,
        command: request.commandType,
        payload: { request, safety, dryRun, approvalId: approval.id },
        status: dryRun ? 'ACKED' : 'SENT',
        mqttTopic: this.commandTopic(request),
        requestId: commandId,
        sentAt: new Date(),
        ackAt: dryRun ? new Date() : undefined
      }
    });
    const execution = await (this.prisma as any).actionExecution.create({
      data: {
        tenantId: request.tenantId,
        actionPlanId: actionPlan.id,
        deviceId: device.id,
        command: `VALVE_${request.commandType}`,
        status: dryRun ? 'ACKED' : 'SENT',
        requestId: commandId,
        result: {
          dryRun,
          commandId,
          queueJobId: queueJob.id,
          deviceCommandId: deviceCommand.id,
          simulatedAck: dryRun
        },
        executedAt: new Date(),
        feedbackAt: dryRun ? new Date() : undefined,
        feedback: dryRun ? this.simulatedAck(request) : undefined
      }
    });

    await (this.prisma as any).actionQueueJob.update({ where: { id: queueJob.id }, data: { actionExecutionId: execution.id } });
    if (dryRun) {
      await this.applyDryRunValveState(device, request);
    } else {
      await this.deviceControl.send(device.id, {
        command: this.toDeviceControlCommand(request.commandType),
        payload: { ...request },
        remark: 'P13.2 valve real-control path after safety and queue records'
      });
    }

    await this.recordValveEvent('valve.command.requested', 'INFO', device.id, { commandId, queueJobId: queueJob.id, dryRun, commandType: request.commandType });
    await this.audit.record({
      eventType: 'valve.command.requested',
      severity: 'INFO',
      entityType: 'Device',
      entityId: device.id,
      payload: { commandId, queueJobId: queueJob.id, dryRun, commandType: request.commandType, safety }
    });

    return {
      commandId,
      queueJobId: queueJob.id,
      dryRun,
      safety,
      approval: { id: approval.id, status: approval.status, demoApproval: dryRun },
      deviceCommandId: deviceCommand.id,
      actionExecutionId: execution.id,
      ack: dryRun ? this.simulatedAck(request) : null
    };
  }

  private async checkValveSafety(device: any, options: ValveCommandOptions, dryRun: boolean) {
    const reasons: string[] = [];
    const role = this.requestContext.getRole();
    if (role === 'VIEWER') reasons.push('PERMISSION_DENIED');
    if (device.type !== 'VALVE') reasons.push('VALVE_DEVICE_TYPE_REQUIRED');
    if (!device.fieldId || !device.field) reasons.push('VALVE_NOT_BOUND');
    if (!device.online && !dryRun) reasons.push('VALVE_OFFLINE');
    if (!this.valveFeedbackRequired() && !dryRun) reasons.push('VALVE_FEEDBACK_REQUIRED');
    if (!dryRun && !this.valveRealControlAllowed()) reasons.push('REAL_CONTROL_DISABLED');
    if (!dryRun && this.valveRealControlAllowed()) reasons.push('APPROVAL_REQUIRED');
    if (this.config.get<string>('NODE_ENV') === 'production' && !dryRun && !this.valveRealControlAllowed()) reasons.push('DRY_RUN_ONLY');
    if (options.openingPercent !== undefined && (options.openingPercent < 0 || options.openingPercent > 100)) reasons.push('OPENING_PERCENT_OUT_OF_RANGE');
    if (options.commandType === 'TEST_OPEN' && (options.testDurationSeconds ?? 3) > this.valveMaxOpenSeconds()) reasons.push('TEST_OPEN_TOO_LONG');

    if (['OPEN', 'TEST_OPEN', 'SET_OPENING'].includes(options.commandType)) {
      const running = await (this.prisma as any).deviceCommand.findFirst({
        where: {
          deviceId: device.id,
          command: { in: ['OPEN', 'SET_OPENING', 'TEST_OPEN'] },
          status: { in: ['PENDING', 'SENT'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (running) reasons.push('VALVE_ALREADY_EXECUTING');
    }

    const emergency = device.fieldId
      ? await (this.prisma as any).safetyPolicy.findFirst({ where: { fieldId: device.fieldId, isActive: true, emergencyStopEnabled: true } })
      : null;
    if (emergency && ['OPEN', 'TEST_OPEN', 'SET_OPENING'].includes(options.commandType)) reasons.push('EMERGENCY_STOP_ACTIVE');

    const allowed = reasons.length === 0;
    return {
      allowed,
      errorCode: allowed ? null : reasons[0],
      reasons,
      dryRun,
      feedbackRequired: this.valveFeedbackRequired(),
      realControlAllowed: this.valveRealControlAllowed()
    };
  }

  private findValveDevice(deviceIdOrCode: string) {
    return (this.prisma as any).device.findFirst({
      where: { OR: [{ id: deviceIdOrCode }, { code: deviceIdOrCode }] },
      include: { field: true }
    });
  }

  private createValveDecision(device: any, request: ValveCommandRequest) {
    return (this.prisma as any).decisionRecord.create({
      data: {
        tenantId: request.tenantId,
        fieldId: request.fieldId,
        decisionType: 'DEVICE_HEALTH',
        recommendation: 'CHECK_DEVICE',
        confidence: 1,
        reason: `P13.2 valve ${request.commandType} ${request.dryRun ? 'dry-run' : 'control'} request`,
        status: 'PLANNED',
        metadata: { valveCommand: request, deviceCode: device.code }
      }
    });
  }

  private createValveActionPlan(device: any, decisionId: string, request: ValveCommandRequest, safety: Record<string, unknown>) {
    return (this.prisma as any).actionPlan.create({
      data: {
        tenantId: request.tenantId,
        decisionId,
        fieldId: request.fieldId,
        status: 'EXECUTING',
        actions: [{ type: 'VALVE_CONTROL', command: request.commandType, deviceId: device.id, commandId: request.commandId }],
        safety
      }
    });
  }

  private createDryRunApproval(device: any, actionPlanId: string, decisionRecordId: string, request: ValveCommandRequest) {
    return (this.prisma as any).approvalRequest.create({
      data: {
        tenantId: request.tenantId,
        farmId: request.farmId,
        fieldId: request.fieldId,
        actionPlanId,
        decisionRecordId,
        type: 'ACTION_PLAN',
        targetType: 'ValveCommand',
        targetId: request.commandId,
        riskLevel: request.dryRun ? 'DRY_RUN' : 'HIGH',
        status: request.dryRun ? 'APPROVED' : 'PENDING',
        requestedBy: request.requestedBy,
        approvedBy: request.dryRun ? 'P13.2_DRY_RUN' : undefined,
        reason: request.dryRun ? 'Dry-run valve safety test approval marker' : 'Real valve control requires explicit approval',
        payload: { request, deviceCode: device.code },
        approvedAt: request.dryRun ? new Date() : undefined,
        decidedAt: request.dryRun ? new Date() : undefined
      }
    });
  }

  private async applyDryRunValveState(device: any, request: ValveCommandRequest) {
    const currentStatus = this.objectValue(device.currentStatus);
    const nextOpening =
      request.commandType === 'CLOSE' ? 0 : request.commandType === 'SET_OPENING' ? request.openingPercent ?? 0 : request.commandType === 'READ_STATUS' ? currentStatus.valveOpeningPercent ?? 0 : 5;
    const nextStatus = nextOpening > 0 ? 'OPEN' : 'CLOSED';
    await (this.prisma as any).device.update({
      where: { id: device.id },
      data: {
        currentStatus: {
          ...currentStatus,
          valveStatus: nextStatus,
          valveOpeningPercent: nextOpening,
          lastCommandId: request.commandId,
          lastCommandStatus: 'ACKED',
          lastValveAckAt: new Date().toISOString(),
          dryRun: true
        },
        lastReportedAt: new Date()
      }
    });
  }

  private simulatedAck(request: ValveCommandRequest): ValveCommandAck {
    const opening =
      request.commandType === 'CLOSE' ? 0 : request.commandType === 'SET_OPENING' ? request.openingPercent ?? 0 : request.commandType === 'READ_STATUS' ? 0 : 5;
    return {
      commandId: request.commandId,
      deviceId: request.deviceId,
      accepted: true,
      status: 'ACKED',
      valveStatus: opening > 0 ? 'OPEN' : 'CLOSED',
      valveOpeningPercent: opening,
      timestamp: new Date().toISOString()
    };
  }

  private toDeviceControlCommand(commandType: ValveCommandType) {
    if (commandType === 'OPEN') return 'VALVE_OPEN';
    if (commandType === 'TEST_OPEN') return 'TEST_OPEN_VALVE';
    if (commandType === 'CLOSE') return 'VALVE_CLOSE';
    if (commandType === 'SET_OPENING') return 'SET_VALVE_OPENING';
    return 'SET_VALVE_OPENING';
  }

  private commandTopic(request: ValveCommandRequest) {
    return `agrios/${request.tenantId}/${request.farmId}/devices/${request.deviceCode}/commands`;
  }

  private recordValveEvent(eventType: string, severity: string, deviceId: string | undefined, payload: Record<string, unknown>) {
    return (this.prisma as any).eventLog
      .create({
        data: {
          tenantId: this.requestContext.getTenantId(),
          farmId: typeof payload.farmId === 'string' ? payload.farmId : undefined,
          userId: this.requestContext.getUserId(),
          requestId: this.requestContext.getRequestId(),
          eventType,
          entityType: 'Device',
          entityId: deviceId,
          severity,
          payload
        }
      })
      .then((event: any) => {
        this.eventBus.publish(eventType, { ...payload, entityType: 'Device', entityId: deviceId }, this.requestContext.getTenantId());
        return event;
      });
  }

  private valveDryRun() {
    return (this.config.get<string>('DEVICE_CONTROL_DRY_RUN') ?? 'true').toLowerCase() !== 'false';
  }

  private valveRealControlAllowed() {
    return (this.config.get<string>('VALVE_ALLOW_REAL_CONTROL') ?? 'false').toLowerCase() === 'true';
  }

  private valveFeedbackRequired() {
    return (this.config.get<string>('VALVE_REQUIRE_FEEDBACK') ?? 'true').toLowerCase() !== 'false';
  }

  private valveCommandTimeoutMs() {
    const value = Number(this.config.get<string>('VALVE_COMMAND_TIMEOUT_MS') ?? 10000);
    return Number.isFinite(value) && value >= 1000 ? value : 10000;
  }

  private valveMaxOpenSeconds() {
    const value = Number(this.config.get<string>('VALVE_MAX_OPEN_SECONDS') ?? 30);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 30) : 30;
  }

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }
}
