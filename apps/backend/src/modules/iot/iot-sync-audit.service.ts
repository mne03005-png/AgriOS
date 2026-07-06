import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

type CreateSyncAuditInput = {
  tenantId?: string | null;
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
  private readonly logger = new Logger(IotSyncAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  create(input: CreateSyncAuditInput) {
    return (this.prisma as any).ioTSyncAudit.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
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
    const scopedWhere = this.tenantWhere(where);
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).ioTSyncAudit.findMany({
        where: scopedWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      (this.prisma as any).ioTSyncAudit.count({ where: scopedWhere })
    ]);
    return { total, page, pageSize, items: items.map((item: any) => this.sanitizeAudit(item, this.canIncludeRaw(query.includeRaw))) };
  }

  async findOne(id: string, includeRaw = false) {
    const audit = await (this.prisma as any).ioTSyncAudit.findFirst({ where: this.tenantWhere({ id }) });
    if (!audit) throw new NotFoundException('IoT sync audit not found');
    return this.sanitizeAudit(audit, this.canIncludeRaw(includeRaw));
  }

  async exportOne(id: string, format = 'json', includeRaw = false) {
    const audit = await (this.prisma as any).ioTSyncAudit.findFirst({ where: this.tenantWhere({ id }) });
    if (!audit) throw new NotFoundException('IoT sync audit not found');
    const sanitized = this.sanitizeAudit(audit, this.canIncludeRaw(includeRaw));
    const result = {
      format: format === 'json' ? 'json' : 'json',
      audit: {
        id: sanitized.id,
        tenantId: sanitized.tenantId,
        source: sanitized.source,
        syncType: sanitized.syncType,
        total: sanitized.total,
        created: sanitized.created,
        updated: sanitized.updated,
        bound: sanitized.bound,
        unbound: sanitized.unbound,
        startedAt: sanitized.startedAt,
        finishedAt: sanitized.finishedAt,
        createdAt: sanitized.createdAt
      },
      warnings: sanitized.warnings ?? [],
      ...(sanitized.rawResult ? { rawResult: sanitized.rawResult } : {})
    };
    this.logger.log({
      event: 'iot.sync_audit.exported',
      auditId: id,
      tenantId: audit.tenantId ?? this.requestContext.getTenantId(),
      userId: this.requestContext.getUserId(),
      exportedAt: new Date().toISOString()
    });
    return result;
  }

  private positiveInt(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }

  private tenantWhere<T extends Record<string, unknown>>(where: T) {
    const tenantId = this.requestContext.getTenantId();
    const role = this.requestContext.getRole();
    if (!tenantId || role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN') return where;
    return { ...where, tenantId };
  }

  private canIncludeRaw(value: unknown) {
    const role = this.requestContext.getRole();
    const requested = value === true || value === 'true';
    return requested && (role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN');
  }

  private sanitizeAudit(audit: any, includeRaw: boolean) {
    if (!audit) return audit;
    const { rawResult: _rawResult, ...rest } = audit;
    return {
      ...rest,
      ...(includeRaw ? { rawResult: this.sanitizeSensitiveKeys(_rawResult) } : {})
    };
  }

  private sanitizeSensitiveKeys(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeSensitiveKeys(item));
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return value;
    const blocked = new Set([
      'rawPayload',
      'rawRequest',
      'rawResponse',
      'requestHeaders',
      'authorization',
      'accessToken',
      'deviceToken',
      'resultPayload',
      'stack',
      'thingsboardAccessToken',
      'mqttPassword',
      'password',
      'secret',
      'apiKey',
      'privateKey'
    ]);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !blocked.has(key))
        .map(([key, item]) => [key, this.sanitizeSensitiveKeys(item)])
    );
  }
}
