import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

@Injectable()
export class YieldAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  createRecord(input: Record<string, any>) {
    const yieldKg = this.optionalNumber(input.yieldKg);
    const areaMu = this.optionalNumber(input.areaMu);
    return (this.prisma as any).yieldRecord.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
        farmId: input.farmId,
        fieldId: input.fieldId,
        cropType: input.cropType,
        cropSeason: input.cropSeason,
        yieldKg,
        areaMu,
        yieldPerMu: this.optionalNumber(input.yieldPerMu) ?? (yieldKg && areaMu ? Number((yieldKg / areaMu).toFixed(2)) : undefined),
        source: input.source,
        metadata: input.metadata
      }
    });
  }

  createFactor(input: Record<string, any>) {
    return (this.prisma as any).yieldFactor.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
        farmId: input.farmId,
        fieldId: input.fieldId,
        cropSeason: input.cropSeason,
        factorType: input.factorType,
        refType: input.refType,
        refId: input.refId,
        valueJson: input.valueJson
      }
    });
  }

  listRecords(query: Record<string, unknown> = {}) {
    return (this.prisma as any).yieldRecord.findMany({
      where: this.where(query),
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  listFactors(query: Record<string, unknown> = {}) {
    return (this.prisma as any).yieldFactor.findMany({
      where: this.where(query),
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async summary(query: Record<string, unknown> = {}) {
    const [records, factors] = await Promise.all([this.listRecords(query), this.listFactors(query)]);
    const byFactorType: Record<string, number> = {};
    for (const factor of factors) byFactorType[factor.factorType] = (byFactorType[factor.factorType] ?? 0) + 1;
    const yieldValues = records.map((item: any) => Number(item.yieldPerMu)).filter((value: number) => Number.isFinite(value));
    return {
      recordCount: records.length,
      factorCount: factors.length,
      avgYieldPerMu: yieldValues.length ? Number((yieldValues.reduce((sum: number, value: number) => sum + value, 0) / yieldValues.length).toFixed(2)) : null,
      byFactorType,
      latestRecords: records.slice(0, 10),
      latestFactors: factors.slice(0, 20)
    };
  }

  async createDroneFactor(operation: any) {
    if (!operation.fieldId) return null;
    const factorType = operation.operationType === 'SCOUTING' || operation.operationType === 'MAPPING' ? 'DRONE_SCOUTING' : operation.operationType === 'SPRAYING' ? 'DRONE_SPRAYING' : null;
    if (!factorType) return null;
    const existing = await (this.prisma as any).yieldFactor.findFirst({ where: { refType: 'DroneOperation', refId: operation.id, factorType } });
    if (existing) return existing;
    return this.createFactor({
      tenantId: operation.tenantId,
      farmId: operation.farmId,
      fieldId: operation.fieldId,
      factorType,
      refType: 'DroneOperation',
      refId: operation.id,
      valueJson: {
        operationType: operation.operationType,
        actualAreaMu: operation.actualAreaMu,
        coverageRate: operation.coverageRate,
        missedAreaMu: operation.missedAreaMu,
        repeatedAreaMu: operation.repeatedAreaMu,
        chemicalName: operation.chemicalName,
        sprayVolumeL: operation.sprayVolumeL
      }
    });
  }

  private where(query: Record<string, unknown>) {
    return {
      ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
      ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {})
    };
  }

  private optionalNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
}
