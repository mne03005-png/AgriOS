import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationLogService } from '../operation-log/operation-log.service';

type CreateDeadLetterInput = {
  eventType: string;
  deviceName?: string;
  thingsboardDeviceId?: string;
  rawPayload?: unknown;
  errorMessage: string;
  errorStack?: string;
};

@Injectable()
export class IotWebhookDeadLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService
  ) {}

  create(input: CreateDeadLetterInput) {
    return (this.prisma as any).ioTWebhookDeadLetter.create({
      data: {
        source: 'thingsboard',
        eventType: input.eventType,
        deviceName: input.deviceName,
        thingsboardDeviceId: input.thingsboardDeviceId,
        rawPayload: input.rawPayload as any,
        errorMessage: input.errorMessage,
        errorStack: input.errorStack
      }
    });
  }

  async findAll(query: Record<string, unknown> = {}) {
    const page = this.positiveInt(query.page, 1);
    const pageSize = Math.min(this.positiveInt(query.pageSize, 20), 100);
    const where: Record<string, unknown> = {};
    if (typeof query.status === 'string' && query.status) where.status = query.status;
    if (typeof query.source === 'string' && query.source) where.source = query.source;
    if (typeof query.deviceName === 'string' && query.deviceName) where.deviceName = { contains: query.deviceName };
    if (typeof query.keyword === 'string' && query.keyword) {
      where.OR = [
        { eventType: { contains: query.keyword } },
        { deviceName: { contains: query.keyword } },
        { thingsboardDeviceId: { contains: query.keyword } },
        { errorMessage: { contains: query.keyword } }
      ];
    }
    if (typeof query.from === 'string' || typeof query.to === 'string') {
      where.createdAt = {
        ...(typeof query.from === 'string' ? { gte: new Date(query.from) } : {}),
        ...(typeof query.to === 'string' ? { lte: new Date(query.to) } : {})
      };
    }
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).ioTWebhookDeadLetter.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      (this.prisma as any).ioTWebhookDeadLetter.count({ where })
    ]);
    return { total, page, pageSize, items };
  }

  async markResolved(id: string, remark?: string) {
    const existing = await (this.prisma as any).ioTWebhookDeadLetter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook dead letter not found');

    const updated = await (this.prisma as any).ioTWebhookDeadLetter.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() }
    });
    await this.operationLogService.create({
      action: 'RESOLVE_IOT_WEBHOOK_DEAD_LETTER',
      targetType: 'IoTWebhookDeadLetter',
      targetId: id,
      description: 'Resolve IoT webhook dead letter',
      metadata: { remark }
    });
    return updated;
  }

  async preview(id: string, handler: (payload: any) => Promise<Record<string, any>>) {
    const existing = await (this.prisma as any).ioTWebhookDeadLetter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook dead letter not found');
    if (!existing.rawPayload || typeof existing.rawPayload !== 'object') {
      throw new BadRequestException('Webhook dead letter rawPayload is empty or invalid');
    }
    return handler(existing.rawPayload);
  }

  async diff(id: string, handler: (payload: any) => Promise<Record<string, any>>) {
    const preview = await this.preview(id, handler);
    await this.operationLogService.create({
      action: 'DEAD_LETTER_DIFF_VIEWED',
      targetType: 'IoTWebhookDeadLetter',
      targetId: id,
      description: 'View IoT webhook dead letter replay diff',
      metadata: { preview } as any
    });
    return {
      deadLetterId: id,
      deviceName: preview.deviceName,
      changes: {
        sensorRecord: {
          willCreate: !preview.duplicatedTelemetryLikely,
          duplicated: Boolean(preview.duplicatedTelemetryLikely),
          matchedExistingId: preview.matchedExistingSensorRecordId ?? null
        },
        irrigationAdvice: {
          willCreate: Boolean(preview.mayCreateIrrigationAdvice),
          skippedReason: preview.mayCreateIrrigationAdvice ? null : this.irrigationSkippedReason(preview)
        },
        deviceBinding: {
          matchedDevice: Boolean(preview.deviceMatched),
          plotId: preview.plotId ?? null,
          bindingSource: preview.bindingSource ?? null
        }
      },
      warnings: preview.warnings ?? []
    };
  }

  async retry(id: string, handler: (payload: any) => Promise<Record<string, any>>) {
    const existing = await (this.prisma as any).ioTWebhookDeadLetter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook dead letter not found');
    if (existing.status === 'RESOLVED') {
      throw new BadRequestException('Webhook dead letter is already resolved');
    }
    if (!existing.rawPayload || typeof existing.rawPayload !== 'object') {
      throw new BadRequestException('Webhook dead letter rawPayload is empty or invalid');
    }

    const retryCount = existing.retryCount + 1;
    try {
      const replayResult = await handler(existing.rawPayload);
      const resolved = Boolean(replayResult.accepted || replayResult.duplicatedTelemetry || replayResult.duplicated);
      const updated = await (this.prisma as any).ioTWebhookDeadLetter.update({
        where: { id },
        data: {
          retryCount,
          retriedAt: new Date(),
          resolvedAt: resolved ? new Date() : existing.resolvedAt,
          status: resolved ? 'RESOLVED' : 'RETRIED',
          errorMessage: resolved ? existing.errorMessage : replayResult.warning ?? replayResult.warnings?.join('; ') ?? existing.errorMessage
        }
      });
      await this.operationLogService.create({
        action: 'RETRY_IOT_WEBHOOK_DEAD_LETTER',
        targetType: 'IoTWebhookDeadLetter',
        targetId: id,
        description: 'Retry IoT webhook dead letter',
        metadata: { retryCount, resolved, replayResult }
      });
      return {
        retried: true,
        deadLetterId: id,
        retryCount,
        resolved,
        sensorRecordId: replayResult.sensorRecordId ?? null,
        irrigationAdviceCreated: Boolean(replayResult.irrigationAdviceCreated ?? replayResult.adviceCreated),
        deadLetter: updated,
        replayResult
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = await (this.prisma as any).ioTWebhookDeadLetter.update({
        where: { id },
        data: {
          retryCount,
          retriedAt: new Date(),
          status: 'RETRIED',
          errorMessage: message,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      await this.operationLogService.create({
        action: 'RETRY_IOT_WEBHOOK_DEAD_LETTER_FAILED',
        targetType: 'IoTWebhookDeadLetter',
        targetId: id,
        description: 'Retry IoT webhook dead letter failed',
        metadata: { retryCount, errorMessage: message }
      });
      return {
        retried: true,
        deadLetterId: id,
        retryCount,
        resolved: false,
        errorMessage: message,
        deadLetter: updated
      };
    }
  }

  async batchRetry(input: { ids?: string[]; maxCount?: number }, handler: (payload: any) => Promise<Record<string, any>>) {
    const maxCount = Math.min(this.positiveInt(input.maxCount, 20), 50);
    const ids = input.ids?.length ? input.ids.slice(0, maxCount) : await this.findPendingIds(maxCount);
    const items = [];
    for (const id of ids) {
      try {
        const existing = await (this.prisma as any).ioTWebhookDeadLetter.findUnique({ where: { id } });
        if (!existing) {
          items.push({ id, retried: false, resolved: false, skipped: true, error: 'Webhook dead letter not found' });
          continue;
        }
        if (existing.status === 'RESOLVED') {
          items.push({ id, retried: false, resolved: true, skipped: true, error: null });
          continue;
        }
        const result = await this.retry(id, handler);
        items.push({ id, retried: true, resolved: Boolean(result.resolved), skipped: false, error: result.errorMessage ?? null, result });
      } catch (error) {
        items.push({ id, retried: false, resolved: false, skipped: false, error: this.errorMessage(error) });
      }
    }
    return {
      total: items.length,
      retried: items.filter((item) => item.retried).length,
      resolved: items.filter((item) => item.resolved).length,
      failed: items.filter((item) => item.error && !item.skipped).length,
      skipped: items.filter((item) => item.skipped).length,
      items
    };
  }

  async batchMarkResolved(input: { ids?: string[]; remark?: string }) {
    const ids = input.ids ?? [];
    const items = [];
    for (const id of ids) {
      try {
        const deadLetter = await this.markResolved(id, input.remark);
        items.push({ id, resolved: true, skipped: false, error: null, deadLetter });
      } catch (error) {
        items.push({ id, resolved: false, skipped: false, error: this.errorMessage(error) });
      }
    }
    return {
      total: items.length,
      resolved: items.filter((item) => item.resolved).length,
      failed: items.filter((item) => item.error).length,
      items
    };
  }

  private async findPendingIds(maxCount: number) {
    const items = await (this.prisma as any).ioTWebhookDeadLetter.findMany({
      where: { status: 'PENDING' },
      select: { id: true },
      take: maxCount,
      orderBy: { createdAt: 'asc' }
    });
    return items.map((item: { id: string }) => item.id);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private irrigationSkippedReason(preview: Record<string, any>) {
    if (!preview.plotId) return 'Device is not bound to a field.';
    if (preview.duplicatedTelemetryLikely) return 'Telemetry appears duplicated.';
    return 'Telemetry does not meet irrigation advice rule.';
  }

  private positiveInt(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }
}
