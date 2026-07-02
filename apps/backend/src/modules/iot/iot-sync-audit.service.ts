import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationLogService } from '../operation-log/operation-log.service';

type CreateSyncAuditInput = {
  syncType: string;
  total: number;
  created: number;
  updated: number;
  bound: number;
  unbound: number;
  warnings: string[];
  rawResult: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date;
};

@Injectable()
export class IotSyncAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService
  ) {}

  create(input: CreateSyncAuditInput) {
    return (this.prisma as any).ioTSyncAudit.create({
      data: {
        source: 'thingsboard',
        syncType: input.syncType,
        total: input.total,
        created: input.created,
        updated: input.updated,
        bound: input.bound,
        unbound: input.unbound,
        warnings: input.warnings,
        rawResult: input.rawResult,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt
      }
    });
  }

  async findAll(query: Record<string, unknown> = {}) {
    const page = this.positiveInt(query.page, 1);
    const pageSize = Math.min(this.positiveInt(query.pageSize, 20), 100);
    const where: Record<string, unknown> = {};
    if (typeof query.syncType === 'string' && query.syncType) where.syncType = query.syncType;
    if (typeof query.from === 'string' || typeof query.to === 'string') {
      where.createdAt = {
        ...(typeof query.from === 'string' ? { gte: new Date(query.from) } : {}),
        ...(typeof query.to === 'string' ? { lte: new Date(query.to) } : {})
      };
    }
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).ioTSyncAudit.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      (this.prisma as any).ioTSyncAudit.count({ where })
    ]);
    return { total, page, pageSize, items };
  }

  async findOne(id: string) {
    const audit = await (this.prisma as any).ioTSyncAudit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException('IoT sync audit not found');
    return audit;
  }

  async exportOne(id: string, format = 'json') {
    const audit = await this.findOne(id);
    const result = {
      format: format === 'json' ? 'json' : 'json',
      audit: {
        id: audit.id,
        source: audit.source,
        syncType: audit.syncType,
        total: audit.total,
        created: audit.created,
        updated: audit.updated,
        bound: audit.bound,
        unbound: audit.unbound,
        startedAt: audit.startedAt,
        finishedAt: audit.finishedAt,
        createdAt: audit.createdAt
      },
      warnings: audit.warnings ?? [],
      rawResult: audit.rawResult ?? {}
    };
    await this.operationLogService.create({
      action: 'SYNC_AUDIT_EXPORTED',
      targetType: 'IoTSyncAudit',
      targetId: id,
      description: 'Export IoT sync audit as JSON',
      metadata: { format: result.format } as any
    });
    return result;
  }

  private positiveInt(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }
}
