import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DroneStatisticsService } from './drone-statistics.service';

@Injectable()
export class DroneFieldMatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statisticsService: DroneStatisticsService
  ) {}

  async matchField(operation: any) {
    if (operation.fieldId) {
      const boundary = await (this.prisma as any).fieldBoundary.findFirst({
        where: { farmId: operation.farmId, fieldId: operation.fieldId, status: { in: ['APPROVED', 'REVIEWED', 'CANDIDATE'] } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }]
      });
      return this.applyMatch(operation, operation.fieldId, boundary?.id, 'LINKED', { matchSource: 'FIELD_ID_PRIORITY' });
    }

    const operationGeo = operation.coverageGeoJson ?? operation.routeGeoJson;
    const operationCenter = this.statisticsService.centroid(operationGeo);
    const operationBBox = this.statisticsService.bbox(operationGeo);
    if (!operationCenter) {
      return this.markNeedsManualLink(operation, 'No operation geometry centroid available.');
    }

    const boundaries = await (this.prisma as any).fieldBoundary.findMany({
      where: { farmId: operation.farmId, status: { not: 'ARCHIVED' } },
      take: 200
    });
    let best: any = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const boundary of boundaries) {
      const boundaryCenter = this.statisticsService.centroid(boundary.polygon);
      const boundaryBBox = this.statisticsService.bbox(boundary.polygon);
      if (!boundaryCenter) continue;
      const distanceM = this.statisticsService.distanceBetween(operationCenter, boundaryCenter);
      const overlap = operationBBox && boundaryBBox ? this.statisticsService.bboxOverlapRatio(operationBBox, boundaryBBox) : 0;
      const score = overlap * 1000 - distanceM / 10;
      if (score > bestScore) {
        best = { boundary, distanceM, overlap, score };
        bestScore = score;
      }
    }
    if (!best) return this.markNeedsManualLink(operation, 'No candidate FieldBoundary found.');
    const matched = await this.applyMatch(operation, best.boundary.fieldId, best.boundary.id, best.boundary.fieldId ? 'LINKED' : 'PARSED', {
      matchSource: 'CENTROID_BBOX_SCORE',
      distanceM: Number(best.distanceM.toFixed(2)),
      bboxOverlapRatio: best.overlap,
      score: Number(best.score.toFixed(2)),
      needsManualLink: !best.boundary.fieldId
    });
    return matched;
  }

  private applyMatch(operation: any, fieldId?: string | null, fieldBoundaryId?: string | null, status = 'LINKED', matchResult: Record<string, unknown> = {}) {
    return (this.prisma as any).droneOperation.update({
      where: { id: operation.id },
      data: {
        fieldId,
        fieldBoundaryId,
        status,
        rawJson: { ...(operation.rawJson ?? {}), matchResult }
      }
    });
  }

  private markNeedsManualLink(operation: any, reason: string) {
    return (this.prisma as any).droneOperation.update({
      where: { id: operation.id },
      data: {
        status: 'PARSED',
        rawJson: { ...(operation.rawJson ?? {}), matchResult: { needsManualLink: true, reason } }
      }
    });
  }
}
