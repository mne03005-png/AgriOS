import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { CheckSafetyDto } from './dto/check-safety.dto';
import { CreateSafetyPolicyDto } from './dto/create-safety-policy.dto';
import { UpdateSafetyPolicyDto } from './dto/update-safety-policy.dto';

@Injectable()
export class SafetyService {
  private readonly maxDailyWaterAmount = 5000;
  private readonly maxDurationMinutes = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService
  ) {}

  async check(dto: CheckSafetyDto) {
    const risks: string[] = [];
    if ((dto.plannedWaterAmount ?? 0) > this.maxDailyWaterAmount) risks.push('计划用水量超过单日安全阈值');
    if ((dto.durationMinutes ?? 0) > this.maxDurationMinutes) risks.push('计划灌溉时长超过安全阈值');
    if (typeof dto.soilMoisture === 'number' && dto.soilMoisture > 70) risks.push('土壤湿度偏高，不建议继续灌溉');
    return this.buildSafetyResult(dto.fieldId, risks, { ...dto });
  }

  async checkActionPlan(actionPlan: any, options: { autoExecute?: boolean } = {}) {
    const safety = actionPlan.safety ?? {};
    const blocks = [...(Array.isArray(safety.blocks) ? safety.blocks : [])];
    const warnings = [...(Array.isArray(safety.warnings) ? safety.warnings : [])];
    const policy = await this.findActivePolicy(actionPlan.fieldId);
    if (policy?.emergencyStopEnabled) blocks.push('EMERGENCY_STOP_ENABLED');
    if (options.autoExecute && !policy?.allowAutoExecution) warnings.push('AUTO_EXECUTION_REQUIRES_APPROVAL');
    if (safety.engineering?.wettingSimulationResult?.deepPercolationRisk === 'HIGH') blocks.push('HIGH_DEEP_PERCOLATION_RISK');
    if (warnings.includes('MISSING_MOISTURE_DATA_REQUIRES_MANUAL_APPROVAL')) {
      await this.createApproval(actionPlan, 'MISSING_MOISTURE_DATA_REQUIRES_MANUAL_APPROVAL');
    }
    if (blocks.length > 0) {
      await (this.prisma as any).actionPlan.update({ where: { id: actionPlan.id }, data: { status: 'BLOCKED', safety: { ...safety, blocks, warnings } } });
      await this.createApproval(actionPlan, blocks.join(', '));
      this.eventBus.publish('safety.blocked', { actionPlanId: actionPlan.id, fieldId: actionPlan.fieldId, blocks }, this.requestContext.getTenantId());
      return { allowed: false, status: 'BLOCKED', blocks, warnings };
    }
    if (warnings.length > 0 && options.autoExecute) {
      await (this.prisma as any).actionPlan.update({ where: { id: actionPlan.id }, data: { status: 'PENDING_APPROVAL', safety: { ...safety, blocks, warnings } } });
      return { allowed: false, status: 'PENDING_APPROVAL', blocks, warnings };
    }
    return { allowed: true, status: 'PASS', blocks, warnings };
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
    return (this.prisma as any).safetyPolicy.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId: input.farmId,
        fieldId: input.fieldId,
        name: 'Emergency Stop',
        emergencyStopEnabled: input.enabled ?? true,
        allowAutoExecution: false
      }
    });
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
