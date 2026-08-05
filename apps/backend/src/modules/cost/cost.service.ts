import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateCostDto } from './dto/create-cost.dto';
import { ReverseCostDto } from './dto/reverse-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';

@Injectable()
export class CostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  async create(dto: CreateCostDto) {
    await this.assertCropSeasonInScope(dto.cropSeasonId);
    return this.prisma.costRecord.create({ data: { ...this.toPrismaData(dto), ...this.tenantData() } as any });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.cropSeasonId ? { cropSeasonId: query.cropSeasonId } : {}),
      ...this.farmScope(),
      ...this.tenantWhere()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.costRecord.findMany({ where, skip, take, orderBy: { occurredDate: 'desc' }, include: { cropSeason: true } }),
      this.prisma.costRecord.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { cropSeason: { field: { farmId } } } : {};
  }

  async findOne(id: string) {
    const costRecord = await this.prisma.costRecord.findFirst({ where: { id, ...this.tenantWhere() }, include: { cropSeason: true } });
    if (!costRecord) {
      throw new NotFoundException('Cost record not found');
    }
    return costRecord;
  }

  async update(id: string, dto: UpdateCostDto) {
    await this.assertInScope(id);
    if (dto.cropSeasonId) await this.assertCropSeasonInScope(dto.cropSeasonId);
    return this.prisma.costRecord.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  async remove(id: string) {
    await this.assertInScope(id);
    return this.prisma.costRecord.delete({ where: { id } });
  }

  async summaryBySeason(cropSeasonId: string) {
    const cropSeason = await this.prisma.cropSeason.findFirst({
      where: { id: cropSeasonId, ...this.tenantWhere() },
      include: { field: true }
    });
    if (!cropSeason) {
      throw new NotFoundException('Crop season not found');
    }
    const grouped = await this.prisma.costRecord.groupBy({
      by: ['type'],
      where: { cropSeasonId, isReversed: false },
      _sum: { amount: true }
    });

    const result = {
      seedCost: 0,
      fertilizerCost: 0,
      pesticideCost: 0,
      laborCost: 0,
      droneCost: 0,
      machineryCost: 0,
      irrigationCost: 0,
      rentCost: 0,
      otherCost: 0,
      totalCost: 0,
      costPerMu: 0
    };

    const map: Record<string, keyof typeof result> = {
      SEED: 'seedCost',
      FERTILIZER: 'fertilizerCost',
      PESTICIDE: 'pesticideCost',
      LABOR: 'laborCost',
      DRONE: 'droneCost',
      MACHINERY: 'machineryCost',
      IRRIGATION: 'irrigationCost',
      ELECTRICITY: 'irrigationCost',
      RENT: 'rentCost',
      OTHER: 'otherCost'
    };

    for (const item of grouped) {
      const key = map[item.type];
      const amount = Number(item._sum.amount ?? 0);
      result[key] += amount;
      result.totalCost += amount;
    }

    const areaMu = cropSeason?.field?.areaMu ? Number(cropSeason.field.areaMu) : 0;
    result.costPerMu = areaMu > 0 ? Number((result.totalCost / areaMu).toFixed(2)) : 0;

    return {
      cropSeason,
      ...result
    };
  }

  async reverse(id: string, dto: ReverseCostDto) {
    await this.findOne(id);
    const costRecord = await this.prisma.costRecord.update({
      where: { id },
      data: {
        isReversed: true,
        reversedAt: new Date(),
        reverseReason: dto.reason
      },
      include: { cropSeason: true }
    });

    await this.operationLogService.create({
      action: 'REVERSE_COST_RECORD',
      targetType: 'COST_RECORD',
      targetId: id,
      description: '冲正成本记录',
      metadata: {
        cropSeasonId: costRecord.cropSeasonId,
        sourceType: costRecord.sourceType,
        sourceId: costRecord.sourceId,
        reason: dto.reason
      }
    });

    return costRecord;
  }

  private toPrismaData(dto: CreateCostDto | UpdateCostDto) {
    return removeUndefined({
      ...dto,
      occurredDate: dateOrUndefined(dto.occurredDate)
    });
  }

  private tenantWhere() {
    if (this.requestContextService.isPlatformAdmin()) return {};
    const tenantId = this.requestContextService.getTenantId();
    return tenantId ? { tenantId } : { id: '__missing_tenant__' };
  }

  private tenantData() {
    if (this.requestContextService.isPlatformAdmin()) return {};
    return { tenantId: this.requestContextService.getTenantId() };
  }

  private async assertInScope(id: string) {
    const item = await this.prisma.costRecord.findFirst({ where: { id, ...this.tenantWhere() }, select: { id: true } });
    if (!item) throw new NotFoundException('Cost record not found');
  }

  private async assertCropSeasonInScope(cropSeasonId: string) {
    if (this.requestContextService.isPlatformAdmin()) return;
    const cropSeason = await this.prisma.cropSeason.findFirst({ where: { id: cropSeasonId, tenantId: this.requestContextService.getTenantId() }, select: { id: true } });
    if (!cropSeason) throw new NotFoundException('Crop season not found');
  }
}
