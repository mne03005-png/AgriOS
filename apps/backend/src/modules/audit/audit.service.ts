import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  record(input: {
    tenantId?: string | null;
    userId?: string | null;
    eventType: string;
    severity?: AuditSeverity;
    entityType?: string;
    entityId?: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    payload?: unknown;
  }) {
    return (this.prisma as any).auditEvent.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
        userId: input.userId ?? this.requestContext.getUserId(),
        eventType: input.eventType,
        severity: input.severity ?? 'INFO',
        entityType: input.entityType,
        entityId: input.entityId,
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId ?? this.requestContext.getRequestId(),
        payload: input.payload as any
      }
    });
  }

  list(query: Record<string, unknown>) {
    return (this.prisma as any).auditEvent.findMany({
      where: {
        ...(typeof query.tenantId === 'string' ? { tenantId: query.tenantId } : {}),
        ...(typeof query.eventType === 'string' ? { eventType: query.eventType } : {}),
        ...(typeof query.severity === 'string' ? { severity: query.severity } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: Number(query.pageSize ?? 100)
    });
  }
}
