import { BadRequestException, Injectable } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { ApprovalService } from '../approval/approval.service';
import { BillingService } from '../billing/billing.service';
import { DeviceControlService } from '../device-control/device-control.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { SafetyService } from '../safety/safety.service';
import { RunExecutionDto } from './dto/run-execution.dto';

@Injectable()
export class ExecutionService {
  constructor(
    private readonly safetyService: SafetyService,
    private readonly deviceControlService: DeviceControlService,
    private readonly approvalService: ApprovalService,
    private readonly billingService: BillingService,
    private readonly operationLogService: OperationLogService,
    private readonly eventBus: EventBusService,
    private readonly requestContext: RequestContextService
  ) {}

  async run(dto: RunExecutionDto) {
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
        reason: `安全检查未通过：${safety.risks.join('；')}`
      });
      return { executed: false, mode: dto.mode, safety, approval, message: '安全检查未通过，已转人工审批' };
    }

    if (dto.mode === 'AUTO' && dto.command !== 'PUMP_OFF' && !this.autoModeEnabled()) {
      throw new BadRequestException('AUTO mode is disabled. Set ENABLE_AUTO_EXECUTION=true to enable guarded automation.');
    }

    const result = await this.deviceControlService.send(dto.deviceId, { command: dto.command, remark: `P11 ${dto.mode} execution` });
    await this.operationLogService.create({
      action: 'P11_EXECUTION_RUN',
      targetType: 'DEVICE',
      targetId: dto.deviceId,
      description: 'P11 执行引擎下发设备指令',
      metadata: { ...dto, safety }
    });
    const tenantId = this.requestContext.getTenantId();
    if (tenantId) {
      await this.billingService.recordUsage({
        tenantId,
        type: 'DEVICE_EXECUTION',
        quantity: 1,
        fieldId: dto.fieldId,
        deviceId: dto.deviceId,
        amount: 0
      });
    }
    const event = this.eventBus.publish('action.executed', { fieldId: dto.fieldId, deviceId: dto.deviceId, command: dto.command, mode: dto.mode }, tenantId);
    return { executed: true, mode: dto.mode, safety, result, event };
  }

  private autoModeEnabled() {
    return process.env.ENABLE_AUTO_EXECUTION === 'true';
  }
}
