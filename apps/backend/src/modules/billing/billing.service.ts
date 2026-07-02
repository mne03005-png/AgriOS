import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { CreateUsageRecordDto } from './dto/create-usage-record.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService
  ) {}

  async recordUsage(dto: CreateUsageRecordDto) {
    const usage = await (this.prisma as any).usageRecord.create({
      data: {
        tenantId: dto.tenantId,
        farmId: dto.farmId,
        fieldId: dto.fieldId,
        deviceId: dto.deviceId,
        usageType: dto.type,
        quantity: dto.quantity,
        unit: dto.unit,
        costAmount: dto.amount ?? 0,
        metadata: { refType: dto.refType, refId: dto.refId }
      }
    });
    this.eventBus.publish('billing.usage.recorded', { usageId: usage.id, type: usage.usageType, quantity: usage.quantity }, usage.tenantId);
    return usage;
  }

  async listUsage(query: Record<string, unknown> = {}) {
    const page = this.positiveInt(query.page, 1);
    const pageSize = Math.min(this.positiveInt(query.pageSize, 20), 100);
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId : this.requestContext.getTenantId();
    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(typeof query.type === 'string' ? { usageType: query.type } : {}),
      ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).usageRecord.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { occurredAt: 'desc' } }),
      (this.prisma as any).usageRecord.count({ where })
    ]);
    return { items, pagination: { page, pageSize, total } };
  }

  async tenantSummary(tenantId: string) {
    const grouped = await (this.prisma as any).usageRecord.groupBy({
      by: ['usageType'],
      where: { tenantId },
      _sum: { quantity: true, costAmount: true }
    });
    return {
      tenantId,
      items: grouped.map((item: any) => ({
        type: item.usageType,
        quantity: Number(item._sum.quantity ?? 0),
        amount: Number(item._sum.costAmount ?? 0)
      }))
    };
  }

  createPlan(input: { name: string; code: string; priceMonthly?: number; metadata?: Record<string, unknown> }) {
    return (this.prisma as any).subscriptionPlan.create({
      data: {
        name: input.name,
        monthlyPrice: input.priceMonthly ?? 0,
        features: { code: input.code, ...(input.metadata ?? {}) }
      }
    });
  }

  listPlans() {
    return (this.prisma as any).subscriptionPlan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listInvoices(query: Record<string, unknown> = {}) {
    return (this.prisma as any).invoice.findMany({
      where: { ...(typeof query.tenantId === 'string' ? { tenantId: query.tenantId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  private positiveInt(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }
}
