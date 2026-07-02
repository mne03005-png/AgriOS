import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

@Injectable()
export class CropHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  createObservation(input: Record<string, any>) {
    return (this.prisma as any).cropHealthObservation.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
        farmId: input.farmId,
        fieldId: input.fieldId,
        droneOperationId: input.droneOperationId,
        source: input.source ?? 'MANUAL',
        type: input.type ?? 'UNKNOWN',
        severity: input.severity,
        title: input.title,
        description: input.description,
        locationGeoJson: input.locationGeoJson,
        imageUrls: input.imageUrls,
        metadata: input.metadata
      }
    });
  }

  listObservations(query: Record<string, unknown> = {}) {
    return (this.prisma as any).cropHealthObservation.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async summary(query: Record<string, unknown> = {}) {
    const items = await this.listObservations(query);
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const item of items) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      const severity = item.severity ?? 'UNSPECIFIED';
      bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
    }
    return { total: items.length, byType, bySeverity, latest: items.slice(0, 10) };
  }

  async createDroneObservationPlaceholder(operation: any) {
    if (!['SCOUTING', 'MAPPING'].includes(operation.operationType)) return null;
    const existing = await (this.prisma as any).cropHealthObservation.findFirst({ where: { droneOperationId: operation.id } });
    if (existing) return existing;
    return this.createObservation({
      tenantId: operation.tenantId,
      farmId: operation.farmId,
      fieldId: operation.fieldId,
      droneOperationId: operation.id,
      source: 'DRONE_SCOUTING',
      type: 'UNKNOWN',
      severity: 'REVIEW',
      title: `无人机${operation.operationType === 'MAPPING' ? '测绘' : '巡田'}观察占位`,
      description: 'P11.6 仅记录无人机巡田/测绘观察占位，未做真实病虫害 AI 识别。',
      locationGeoJson: operation.coverageGeoJson ?? operation.routeGeoJson,
      metadata: {
        sourceFileName: operation.sourceFileName,
        prescriptionJson: operation.prescriptionJson,
        rawProperties: operation.rawJson?.properties
      }
    });
  }
}
