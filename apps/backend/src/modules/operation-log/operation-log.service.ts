import { Injectable } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { CreateOperationLogDto } from './dto/create-operation-log.dto';

@Injectable()
export class OperationLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService
  ) {}

  create(dto: CreateOperationLogDto) {
    return this.prisma.operationLog.create({
      data: {
        ...dto,
        userId: dto.userId ?? this.requestContextService.getUserId()
      } as any
    });
  }

  getCurrentUserId() {
    return this.requestContextService.getUserId();
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = query.keyword
      ? {
          OR: [{ action: { contains: query.keyword } }, { targetType: { contains: query.keyword } }, { description: { contains: query.keyword } }]
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.operationLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.operationLog.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findByField(fieldId: string, query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      OR: [
        { targetType: 'FIELD', targetId: fieldId },
        { metadata: { path: '$.fieldId', equals: fieldId } }
      ]
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.operationLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.operationLog.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }
}
