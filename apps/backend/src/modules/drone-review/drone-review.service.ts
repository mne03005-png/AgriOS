import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';
import { CropHealthService } from '../crop-health/crop-health.service';
import { OperationCostService } from '../operation-cost/operation-cost.service';
import { YieldAnalysisService } from '../yield-analysis/yield-analysis.service';
import { DroneStatisticsService } from '../drone-operation/drone-statistics.service';

@Injectable()
export class DroneReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService,
    private readonly farmActivityService: FarmActivityService,
    private readonly operationCostService: OperationCostService,
    private readonly cropHealthService: CropHealthService,
    private readonly yieldAnalysisService: YieldAnalysisService,
    private readonly statisticsService: DroneStatisticsService
  ) {}

  async list(query: Record<string, unknown> = {}) {
    const reviews = await (this.prisma as any).droneOperationReview.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    const operations = await this.operationsById(reviews.map((item: any) => item.droneOperationId));
    return reviews.map((review: any) => ({ ...review, operation: operations[review.droneOperationId] ?? null }));
  }

  async findByOperation(operationId: string) {
    const operation = await this.findOperation(operationId);
    const review = (await (this.prisma as any).droneOperationReview.findFirst({ where: { droneOperationId: operationId }, orderBy: { createdAt: 'desc' } })) ?? (await this.createForOperation(operation));
    return { review, operation };
  }

  async createForOperation(operation: any) {
    const existing = await (this.prisma as any).droneOperationReview.findFirst({ where: { droneOperationId: operation.id } });
    if (existing) return existing;
    const status = this.initialStatus(operation);
    const review = await (this.prisma as any).droneOperationReview.create({
      data: {
        tenantId: operation.tenantId ?? this.requestContext.getTenantId(),
        farmId: operation.farmId,
        droneOperationId: operation.id,
        status,
        correctedFieldId: operation.fieldId,
        correctedFieldBoundaryId: operation.fieldBoundaryId,
        confirmedAreaMu: operation.actualAreaMu,
        confirmedCoverageRate: operation.coverageRate,
        confirmedMissedAreaMu: operation.missedAreaMu,
        confirmedRepeatedAreaMu: operation.repeatedAreaMu,
        reviewNote: status === 'NEEDS_MANUAL_LINK' ? '需要人工绑定地块' : status === 'NEEDS_BOUNDARY_FIX' ? '覆盖率低于 90%，建议人工核查覆盖区' : undefined
      }
    });
    this.eventBus.publish('drone.review.created', { farmId: operation.farmId, fieldId: operation.fieldId, entityType: 'DroneOperationReview', entityId: review.id, droneOperationId: operation.id, status }, operation.tenantId);
    return review;
  }

  async approve(operationId: string, body: Record<string, unknown> = {}) {
    const operation = await this.findOperation(operationId);
    const review = await this.ensureReview(operation);
    const reviewerId = this.reviewerId(body);
    const updatedReview = await (this.prisma as any).droneOperationReview.update({
      where: { id: review.id },
      data: {
        status: 'APPROVED',
        reviewerId,
        reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : review.reviewNote,
        reviewedAt: new Date()
      }
    });
    const reviewedOperation = await (this.prisma as any).droneOperation.update({ where: { id: operation.id }, data: { status: 'REVIEWED' } });
    const operationCostSummary = await this.operationCostService.ensureDroneOperationPlaceholders(reviewedOperation);
    const cropHealthObservation = await this.cropHealthService.createDroneObservationPlaceholder(reviewedOperation);
    const yieldFactor = await this.yieldAnalysisService.createDroneFactor(reviewedOperation);
    await this.farmActivityService.create({
      tenantId: reviewedOperation.tenantId,
      farmId: reviewedOperation.farmId,
      fieldId: reviewedOperation.fieldId,
      type: 'DRONE_OPERATION_REVIEWED',
      title: `无人机作业审核通过：${reviewedOperation.sourceFileName ?? reviewedOperation.id}`,
      refType: 'DroneOperation',
      refId: reviewedOperation.id,
      metadata: { reviewId: updatedReview.id, operationCostSummary, cropHealthObservationId: cropHealthObservation?.id, yieldFactorId: yieldFactor?.id }
    });
    this.eventBus.publish('drone.review.approved', { farmId: reviewedOperation.farmId, fieldId: reviewedOperation.fieldId, entityType: 'DroneOperationReview', entityId: updatedReview.id, droneOperationId: operation.id }, reviewedOperation.tenantId);
    return { review: updatedReview, operation: reviewedOperation, operationCostSummary, cropHealthObservation, yieldFactor };
  }

  async reject(operationId: string, body: Record<string, unknown> = {}) {
    const operation = await this.findOperation(operationId);
    const review = await this.ensureReview(operation);
    const updatedReview = await (this.prisma as any).droneOperationReview.update({
      where: { id: review.id },
      data: {
        status: 'REJECTED',
        reviewerId: this.reviewerId(body),
        reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : typeof body.reason === 'string' ? body.reason : '审核拒绝',
        reviewedAt: new Date()
      }
    });
    const rejectedOperation = await (this.prisma as any).droneOperation.update({ where: { id: operation.id }, data: { status: 'ARCHIVED' } });
    this.eventBus.publish('drone.review.rejected', { farmId: operation.farmId, fieldId: operation.fieldId, entityType: 'DroneOperationReview', entityId: updatedReview.id, droneOperationId: operation.id }, operation.tenantId);
    return { review: updatedReview, operation: rejectedOperation };
  }

  async linkField(operationId: string, body: Record<string, unknown>) {
    const operation = await this.findOperation(operationId);
    const review = await this.ensureReview(operation);
    const fieldId = this.requiredString(body.fieldId, 'fieldId');
    const fieldBoundaryId = typeof body.fieldBoundaryId === 'string' ? body.fieldBoundaryId : undefined;
    const linked = await (this.prisma as any).droneOperation.update({
      where: { id: operation.id },
      data: { fieldId, fieldBoundaryId, status: 'LINKED' }
    });
    const withStats = await this.recalculateStats(linked);
    const updatedReview = await (this.prisma as any).droneOperationReview.update({
      where: { id: review.id },
      data: {
        status: withStats.coverageRate !== null && this.normalizedRate(withStats.coverageRate) < 0.9 ? 'NEEDS_BOUNDARY_FIX' : 'PENDING',
        correctedFieldId: fieldId,
        correctedFieldBoundaryId: fieldBoundaryId,
        confirmedAreaMu: withStats.actualAreaMu,
        confirmedCoverageRate: withStats.coverageRate,
        confirmedMissedAreaMu: withStats.missedAreaMu,
        confirmedRepeatedAreaMu: withStats.repeatedAreaMu,
        reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : undefined
      }
    });
    this.eventBus.publish('drone.review.field.linked', { farmId: withStats.farmId, fieldId, entityType: 'DroneOperationReview', entityId: updatedReview.id, droneOperationId: operation.id }, withStats.tenantId);
    return { review: updatedReview, operation: withStats };
  }

  async updateCoverage(operationId: string, body: Record<string, unknown>) {
    const operation = await this.findOperation(operationId);
    const review = await this.ensureReview(operation);
    const updated = await (this.prisma as any).droneOperation.update({
      where: { id: operation.id },
      data: {
        coverageGeoJson: (body.correctedCoverageGeoJson ?? body.coverageGeoJson ?? operation.coverageGeoJson) as any,
        routeGeoJson: (body.correctedRouteGeoJson ?? body.routeGeoJson ?? operation.routeGeoJson) as any
      }
    });
    const withStats = await this.recalculateStats(updated);
    const updatedReview = await (this.prisma as any).droneOperationReview.update({
      where: { id: review.id },
      data: {
        status: 'PENDING',
        correctedCoverageGeoJson: (body.correctedCoverageGeoJson ?? body.coverageGeoJson) as any,
        correctedRouteGeoJson: (body.correctedRouteGeoJson ?? body.routeGeoJson) as any,
        confirmedAreaMu: withStats.actualAreaMu,
        confirmedCoverageRate: withStats.coverageRate,
        confirmedMissedAreaMu: withStats.missedAreaMu,
        confirmedRepeatedAreaMu: withStats.repeatedAreaMu,
        reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : review.reviewNote
      }
    });
    this.eventBus.publish('drone.review.coverage.updated', { farmId: withStats.farmId, fieldId: withStats.fieldId, entityType: 'DroneOperationReview', entityId: updatedReview.id, droneOperationId: operation.id }, withStats.tenantId);
    return { review: updatedReview, operation: withStats };
  }

  private async ensureReview(operation: any) {
    return (await (this.prisma as any).droneOperationReview.findFirst({ where: { droneOperationId: operation.id }, orderBy: { createdAt: 'desc' } })) ?? (await this.createForOperation(operation));
  }

  private async recalculateStats(operation: any) {
    const stats = await this.statisticsService.calculateDroneOperationStats(operation);
    return (this.prisma as any).droneOperation.update({
      where: { id: operation.id },
      data: {
        actualAreaMu: stats.actualAreaMu,
        flightDistanceM: stats.flightDistanceM,
        coverageRate: stats.coverageRate,
        missedAreaMu: stats.missedAreaMu,
        overlapRate: stats.overlapRate,
        repeatedAreaMu: stats.repeatedAreaMu,
        dosagePerMu: stats.dosagePerMu,
        rawJson: { ...(operation.rawJson ?? {}), statistics: stats, statisticsNote: stats.statisticsNote }
      }
    });
  }

  private async findOperation(operationId: string) {
    const operation = await (this.prisma as any).droneOperation.findUnique({ where: { id: operationId } });
    if (!operation) throw new NotFoundException('Drone operation not found');
    return operation;
  }

  private async operationsById(ids: string[]) {
    if (!ids.length) return {};
    const operations = await (this.prisma as any).droneOperation.findMany({ where: { id: { in: ids } } });
    return Object.fromEntries(operations.map((item: any) => [item.id, item]));
  }

  private initialStatus(operation: any) {
    if (operation.rawJson?.matchResult?.needsManualLink || !operation.fieldId) return 'NEEDS_MANUAL_LINK';
    if (operation.coverageRate !== null && operation.coverageRate !== undefined && this.normalizedRate(operation.coverageRate) < 0.9) return 'NEEDS_BOUNDARY_FIX';
    return 'PENDING';
  }

  private normalizedRate(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return number > 1 ? number / 100 : number;
  }

  private reviewerId(body: Record<string, unknown>) {
    return typeof body.reviewerId === 'string' ? body.reviewerId : this.requestContext.getUserId();
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }
}
