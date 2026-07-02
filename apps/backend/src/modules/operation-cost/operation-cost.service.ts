import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

@Injectable()
export class OperationCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  create(input: Record<string, any>) {
    return (this.prisma as any).operationCost.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
        farmId: input.farmId,
        fieldId: input.fieldId,
        refType: input.refType,
        refId: input.refId,
        category: input.category ?? 'OTHER',
        amount: this.number(input.amount, 0),
        currency: input.currency ?? 'CNY',
        quantity: this.optionalNumber(input.quantity),
        unit: input.unit,
        unitPrice: this.optionalNumber(input.unitPrice),
        note: input.note
      }
    });
  }

  list(query: Record<string, unknown> = {}) {
    return (this.prisma as any).operationCost.findMany({
      where: this.where(query),
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async summary(query: Record<string, unknown> = {}) {
    const where = this.where(query);
    const items = await (this.prisma as any).operationCost.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1000 });
    const byCategory: Record<string, number> = {};
    for (const item of items) {
      byCategory[item.category] = Number(((byCategory[item.category] ?? 0) + Number(item.amount ?? 0)).toFixed(2));
    }
    return {
      totalAmount: Number(items.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0).toFixed(2)),
      currency: items[0]?.currency ?? 'CNY',
      byCategory,
      count: items.length,
      items: items.slice(0, 20)
    };
  }

  async ensureDroneOperationPlaceholders(operation: any) {
    const existing = await (this.prisma as any).operationCost.count({ where: { refType: 'DroneOperation', refId: operation.id } });
    if (existing > 0) return this.summary({ refType: 'DroneOperation', refId: operation.id });
    const created = [];
    if (operation.operationType === 'SPRAYING' && operation.chemicalName) {
      created.push(
        await this.create({
          tenantId: operation.tenantId,
          farmId: operation.farmId,
          fieldId: operation.fieldId,
          refType: 'DroneOperation',
          refId: operation.id,
          category: 'PESTICIDE',
          amount: 0,
          quantity: operation.sprayVolumeL,
          unit: 'L',
          note: `药剂占位：${operation.chemicalName}，等待人工补录单价`
        })
      );
    }
    if (operation.operationType === 'SPRAYING') {
      created.push(
        await this.create({
          tenantId: operation.tenantId,
          farmId: operation.farmId,
          fieldId: operation.fieldId,
          refType: 'DroneOperation',
          refId: operation.id,
          category: 'DRONE_SERVICE',
          amount: 0,
          quantity: operation.actualAreaMu,
          unit: 'mu',
          note: '无人机喷洒服务成本占位，等待人工补录'
        })
      );
    }
    return { totalAmount: 0, currency: 'CNY', byCategory: {}, count: created.length, items: created };
  }

  private where(query: Record<string, unknown>) {
    return {
      ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
      ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
      ...(typeof query.refType === 'string' ? { refType: query.refType } : {}),
      ...(typeof query.refId === 'string' ? { refId: query.refId } : {})
    };
  }

  private number(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  private optionalNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
}
