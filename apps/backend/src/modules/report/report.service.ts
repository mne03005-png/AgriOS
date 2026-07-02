import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService
  ) {}

  async costByField(fieldId: string) {
    const field = await this.prisma.field.findUnique({ where: { id: fieldId }, include: { cropSeasons: true } });
    if (!field) {
      throw new NotFoundException('Field not found');
    }
    this.assertCanAccessFarm(field.farmId);
    const cropSeasonIds = field.cropSeasons.map((item: any) => item.id);
    const summary = await this.costSummary({ cropSeasonId: { in: cropSeasonIds } });
    return {
      field,
      ...summary,
      costPerMu: Number(field.areaMu) > 0 ? Number((summary.totalCost / Number(field.areaMu)).toFixed(2)) : 0
    };
  }

  async costByFarm(farmId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: { fields: { include: { cropSeasons: true } } }
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
    this.assertCanAccessFarm(farm.id);
    const cropSeasonIds = farm.fields.flatMap((field: any) => field.cropSeasons.map((season: any) => season.id));
    const totalAreaMu = farm.fields.reduce((sum: number, field: any) => sum + Number(field.areaMu), 0);
    const summary = await this.costSummary({ cropSeasonId: { in: cropSeasonIds } });
    return {
      farm,
      ...summary,
      costPerMu: totalAreaMu > 0 ? Number((summary.totalCost / totalAreaMu).toFixed(2)) : 0,
      fields: await Promise.all(farm.fields.map((field: any) => this.costByField(field.id)))
    };
  }

  private async costSummary(where: Record<string, unknown>) {
    const grouped = await this.prisma.costRecord.groupBy({
      by: ['type'],
      where: { ...where, isReversed: false },
      _sum: { amount: true }
    } as any);
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
      totalCost: 0
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
      const amount = Number(item._sum?.amount ?? 0);
      result[key] += amount;
      result.totalCost += amount;
    }
    return result;
  }

  private assertCanAccessFarm(farmId: string) {
    const currentFarmId = this.requestContextService.getFarmId();
    if (!this.requestContextService.isPlatformAdmin() && currentFarmId && currentFarmId !== farmId) {
      throw new NotFoundException('Farm not found');
    }
  }
}
