import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

@Injectable()
export class FarmActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  list(query: Record<string, unknown> = {}) {
    return (this.prisma as any).farmActivity.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.type === 'string' ? { type: query.type } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  create(input: {
    tenantId?: string | null;
    farmId: string;
    fieldId?: string | null;
    type: string;
    title: string;
    description?: string;
    refType?: string;
    refId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return (this.prisma as any).farmActivity.create({
      data: {
        tenantId: input.tenantId ?? this.requestContext.getTenantId(),
        farmId: input.farmId,
        fieldId: input.fieldId,
        type: input.type,
        title: input.title,
        description: input.description,
        refType: input.refType,
        refId: input.refId,
        metadata: input.metadata
      }
    });
  }
}
