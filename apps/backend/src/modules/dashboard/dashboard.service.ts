import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  async farmKpi(farmId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId }, include: { fields: true } });
    if (!farm) throw new NotFoundException('Farm not found');
    const fieldIds = farm.fields.map((field: any) => field.id);
    const [deviceCount, onlineDeviceCount, runningIrrigationCount, pendingAdviceCount, costTotal] = await Promise.all([
      this.prisma.device.count({ where: { fieldId: { in: fieldIds } } }),
      this.prisma.device.count({ where: { fieldId: { in: fieldIds }, online: true } }),
      this.prisma.irrigationRecord.count({ where: { fieldId: { in: fieldIds }, status: 'RUNNING' } as any }),
      this.prisma.irrigationAdvice.count({ where: { fieldId: { in: fieldIds }, status: 'PENDING' } as any }),
      this.prisma.costRecord.aggregate({ where: { fieldId: { in: fieldIds }, isReversed: false } as any, _sum: { amount: true } })
    ]);
    return {
      farm,
      tenantId: this.requestContext.getTenantId(),
      kpi: {
        fieldCount: farm.fields.length,
        deviceCount,
        onlineDeviceCount,
        runningIrrigationCount,
        pendingAdviceCount,
        costTotal: Number(costTotal._sum.amount ?? 0)
      }
    };
  }
}
