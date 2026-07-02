import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly operationLogService: OperationLogService
  ) {}

  create(dto: CreateApprovalRequestDto & Record<string, any>) {
    return (this.prisma as any).approvalRequest.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId: dto.farmId,
        fieldId: dto.fieldId,
        actionPlanId: dto.actionPlanId,
        decisionRecordId: dto.decisionRecordId,
        type: this.toApprovalType(dto.type),
        targetType: dto.targetType,
        targetId: dto.targetId,
        riskLevel: dto.riskLevel,
        requestedBy: this.requestContext.getUserId(),
        reason: dto.reason,
        payload: dto.payload
      }
    });
  }

  list(query: Record<string, unknown> = {}) {
    return (this.prisma as any).approvalRequest.findMany({
      where: {
        ...(this.requestContext.getTenantId() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async approve(id: string) {
    const existing = await this.findOne(id);
    const updated = await (this.prisma as any).approvalRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: this.requestContext.getUserId(), approvedAt: new Date(), decidedAt: new Date() }
    });
    await this.operationLogService.create({
      action: 'APPROVE_REQUEST',
      targetType: existing.targetType,
      targetId: existing.targetId,
      description: '审批通过',
      metadata: { approvalRequestId: id }
    });
    return updated;
  }

  async reject(id: string, reason?: string) {
    const existing = await this.findOne(id);
    const updated = await (this.prisma as any).approvalRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: this.requestContext.getUserId(), rejectedAt: new Date(), decidedAt: new Date(), reason: reason ?? existing.reason }
    });
    await this.operationLogService.create({
      action: 'REJECT_REQUEST',
      targetType: existing.targetType,
      targetId: existing.targetId,
      description: '审批拒绝',
      metadata: { approvalRequestId: id, reason }
    });
    return updated;
  }

  private async findOne(id: string) {
    const item = await (this.prisma as any).approvalRequest.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Approval request not found');
    return item;
  }

  private toApprovalType(type: string) {
    return ['ACTION_PLAN', 'AUTO_EXECUTION', 'HIGH_RISK_DECISION', 'MANUAL_OVERRIDE'].includes(type) ? type : 'ACTION_PLAN';
  }
}
