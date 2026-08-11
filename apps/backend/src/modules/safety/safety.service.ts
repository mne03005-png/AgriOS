import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { CheckSafetyDto } from './dto/check-safety.dto';
import { CreateSafetyPolicyDto } from './dto/create-safety-policy.dto';
import { UpdateSafetyPolicyDto } from './dto/update-safety-policy.dto';
import { DeviceControlService } from '../device-control/device-control.service';
import { OperationLogService } from '../operation-log/operation-log.service';

@Injectable()
export class SafetyService {
  private readonly maxDailyWaterAmount = 5000;
  private readonly maxDurationMinutes = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService,
    private readonly deviceControl: DeviceControlService,
    private readonly operationLog: OperationLogService
  ) {}

  async check(dto: CheckSafetyDto) {
    const risks: string[] = [];
    if ((dto.plannedWaterAmount ?? 0) > this.maxDailyWaterAmount) risks.push('计划用水量超过单日安全阈值');
    if ((dto.durationMinutes ?? 0) > this.maxDurationMinutes) risks.push('计划灌溉时长超过安全阈值');
    if (typeof dto.soilMoisture === 'number' && dto.soilMoisture > 70) risks.push('土壤湿度偏高，不建议继续灌溉');
    return this.buildSafetyResult(dto.fieldId, risks, { ...dto });
  }

  async checkActionPlan(actionPlan: any, options: { autoExecute?: boolean; allowDuringEmergencyStop?: boolean } = {}) {
    const safety = actionPlan.safety ?? {};
    const blocks = [...(Array.isArray(safety.blocks) ? safety.blocks : [])];
    const warnings = [...(Array.isArray(safety.warnings) ? safety.warnings : [])];
    const policy = await this.findActivePolicy(actionPlan.fieldId);
    if (policy?.emergencyStopEnabled && !options.allowDuringEmergencyStop) blocks.push('EMERGENCY_STOP_ENABLED');
    if (options.autoExecute && !policy?.allowAutoExecution) warnings.push('AUTO_EXECUTION_REQUIRES_APPROVAL');
    if (safety.engineering?.wettingSimulationResult?.deepPercolationRisk === 'HIGH') blocks.push('HIGH_DEEP_PERCOLATION_RISK');
    if (warnings.includes('MISSING_MOISTURE_DATA_REQUIRES_MANUAL_APPROVAL')) {
      await this.createApproval(actionPlan, 'MISSING_MOISTURE_DATA_REQUIRES_MANUAL_APPROVAL');
    }
    if (blocks.length > 0) {
      await (this.prisma as any).actionPlan.update({ where: { id: actionPlan.id }, data: { status: 'BLOCKED', safety: { ...safety, blocks, warnings } } });
      await this.createApproval(actionPlan, blocks.join(', '));
      this.eventBus.publish('safety.blocked', { actionPlanId: actionPlan.id, fieldId: actionPlan.fieldId, blocks }, this.requestContext.getTenantId());
      return { allowed: false, status: 'BLOCKED', blocks, hardBlocks: blocks, softBlocks: warnings, warnings };
    }
    if (warnings.length > 0 && options.autoExecute) {
      await (this.prisma as any).actionPlan.update({ where: { id: actionPlan.id }, data: { status: 'PENDING_APPROVAL', safety: { ...safety, blocks, warnings } } });
      return { allowed: false, status: 'PENDING_APPROVAL', blocks, hardBlocks: blocks, softBlocks: warnings, warnings };
    }
    return { allowed: true, status: 'PASS', blocks, hardBlocks: blocks, softBlocks: warnings, warnings };
  }

  createPolicy(dto: CreateSafetyPolicyDto) {
    return (this.prisma as any).safetyPolicy.create({ data: { ...dto, tenantId: this.requestContext.getTenantId() } });
  }

  listPolicies(query: Record<string, unknown> = {}) {
    return (this.prisma as any).safetyPolicy.findMany({
      where: {
        ...(this.requestContext.getTenantId() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  updatePolicy(id: string, dto: UpdateSafetyPolicyDto) {
    return (this.prisma as any).safetyPolicy.update({ where: { id }, data: dto });
  }

  async emergencyStop(input: { farmId?: string; fieldId?: string; enabled?: boolean }) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId || !input.farmId) throw new ForbiddenException('Tenant and farm scope are required');
    const scope = { tenantId, farmId: input.farmId, ...(input.fieldId ? { fieldId: input.fieldId } : {}) };
    const farm = await (this.prisma as any).farm.findFirst({ where: { id: input.farmId, tenantId }, select: { id: true } });
    if (!farm) throw new ForbiddenException('Farm is outside current tenant');
    if (input.fieldId) {
      const field = await (this.prisma as any).field.findFirst({ where: { id: input.fieldId, farmId: input.farmId, tenantId }, select: { id: true } });
      if (!field) throw new ForbiddenException('Field is outside requested farm');
    }
    if (input.enabled === false) return this.resetEmergencyStop(scope);

    const existing = await (this.prisma as any).safetyPolicy.findFirst({ where: { ...scope, isActive: true, emergencyStopEnabled: true }, orderBy: { createdAt: 'desc' } });
    if (existing) return { ok: true, state: 'ALREADY_LATCHED', latchId: existing.id, dispatch: 'EXISTING_COMMAND', targetCount: 0 };

    // Persist the latch before resolving or dispatching any device command.
    const latch = await (this.prisma as any).safetyPolicy.create({ data: { ...scope, name: 'Emergency Stop', emergencyStopEnabled: true, allowAutoExecution: false } });
    await (this.prisma as any).actionPlan.updateMany({
      where: { tenantId, status: { in: ['DRAFT', 'READY', 'PENDING_APPROVAL', 'APPROVED'] }, ...(input.fieldId ? { fieldId: input.fieldId } : { decision: { farmId: input.farmId } }) },
      data: { status: 'BLOCKED' }
    });
    const targets = await (this.prisma as any).device.findMany({
      where: { tenantId, type: { in: ['PUMP', 'VALVE'] }, field: { farmId: input.farmId, ...(input.fieldId ? { id: input.fieldId } : {}) } },
      select: { id: true }
    });
    const auditMetadata = { requestId: this.requestContext.getRequestId(), tenantId, farmId: input.farmId, fieldId: input.fieldId, timestamp: new Date().toISOString(), requestedScope: scope, targetCount: targets.length, latchResult: 'LATCHED' };
    await this.operationLog.create({ action: 'EMERGENCY_STOP_LATCH', targetType: input.fieldId ? 'FIELD' : 'FARM', targetId: input.fieldId ?? input.farmId, description: 'Software Emergency Stop latched; dispatch pending', metadata: { ...auditMetadata, dispatchResult: 'PENDING' } });
    const results: Array<{ deviceId: string; ok: boolean; result?: unknown; error?: string }> = [];
    for (const target of targets) {
      try {
        const result = await this.deviceControl.send(target.id, { command: 'EMERGENCY_STOP', controlPath: 'ACTION_QUEUE', commandId: `emergency-stop:${latch.id}:${target.id}` });
        results.push({ deviceId: target.id, ok: this.dispatchSucceeded(result), result });
      } catch (error) {
        results.push({ deviceId: target.id, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const dispatch = targets.length === 0 ? 'NO_CONTROLLABLE_TARGET' : results.every((item) => item.ok) ? 'DISPATCHED' : 'DISPATCH_FAILED';
    await this.operationLog.create({ action: 'EMERGENCY_STOP_DISPATCH_RESULT', targetType: input.fieldId ? 'FIELD' : 'FARM', targetId: input.fieldId ?? input.farmId, description: 'Software Emergency Stop dispatch result', metadata: { ...auditMetadata, dispatchResult: dispatch } });
    return { ok: dispatch === 'DISPATCHED', state: 'LATCHED', latchId: latch.id, dispatch, targetCount: targets.length, results };
  }

  private async resetEmergencyStop(scope: { tenantId: string; farmId: string; fieldId?: string }) {
    const result = await (this.prisma as any).safetyPolicy.updateMany({ where: { ...scope, isActive: true, emergencyStopEnabled: true }, data: { isActive: false, emergencyStopEnabled: false } });
    await this.operationLog.create({ action: 'EMERGENCY_STOP_RESET', targetType: scope.fieldId ? 'FIELD' : 'FARM', targetId: scope.fieldId ?? scope.farmId, description: 'Software Emergency Stop explicitly reset; stale commands remain invalid', metadata: { ...scope, requestId: this.requestContext.getRequestId(), timestamp: new Date().toISOString(), resetCount: result.count, autoResume: false } });
    return { ok: true, state: 'RESET', resetCount: result.count, autoResume: false };
  }

  private dispatchSucceeded(result: unknown) {
    return Boolean(result && typeof result === 'object' && (!('ok' in result) || (result as any).ok) && (result as any).executed !== false);
  }

  async assertDangerousStartAllowed(scope: { tenantId: string; farmId?: string; fieldId?: string }) {
    const active = await (this.prisma as any).safetyPolicy.findFirst({
      where: { tenantId: scope.tenantId, isActive: true, emergencyStopEnabled: true, OR: [{ farmId: scope.farmId }, { fieldId: scope.fieldId }] },
      select: { id: true }
    });
    if (active) throw new ForbiddenException('EMERGENCY_STOP_ACTIVE');
  }

  listAlerts(query: Record<string, unknown> = {}) {
    return (this.prisma as any).safetyAlert.findMany({
      where: {
        ...(this.requestContext.getTenantId() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  private async buildSafetyResult(fieldId: string, risks: string[], metadata: Record<string, unknown>) {
    const allowed = risks.length === 0;
    if (!allowed) {
      const alert = await (this.prisma as any).safetyAlert.create({
        data: {
          tenantId: this.requestContext.getTenantId(),
          fieldId,
          severity: risks.length > 1 ? 'HIGH' : 'MEDIUM',
          alertType: 'IRRIGATION_SAFETY',
          message: risks.join('；'),
          metadata
        }
      });
      this.eventBus.publish('alert.triggered', { alertId: alert.id, fieldId, risks }, this.requestContext.getTenantId());
      return { allowed, risks, mode: 'BLOCKED', alert };
    }
    return { allowed, risks, mode: 'PASS' };
  }

  private findActivePolicy(fieldId: string) {
    return (this.prisma as any).safetyPolicy.findFirst({
      where: { fieldId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  private createApproval(actionPlan: any, reason: string) {
    return (this.prisma as any).approvalRequest.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId: actionPlan.farmId,
        fieldId: actionPlan.fieldId,
        actionPlanId: actionPlan.id,
        decisionRecordId: actionPlan.decisionId,
        type: 'ACTION_PLAN',
        targetType: 'ActionPlan',
        targetId: actionPlan.id,
        status: 'PENDING',
        reason,
        payload: { safety: actionPlan.safety }
      }
    });
  }
}
