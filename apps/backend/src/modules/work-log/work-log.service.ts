import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';

@Injectable()
export class WorkLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  async create(dto: CreateWorkLogDto) {
    return this.prisma.$transaction(async (tx: any) => {
      const workLog = await tx.workLog.create({ data: this.toPrismaData(dto), include: { cropSeason: true } });
      if (dto.cost && dto.cost > 0) {
        const existingCost = await tx.costRecord.findFirst({ where: { sourceRecordId: workLog.id } });
        if (!existingCost) {
          await tx.costRecord.create({
            data: {
              cropSeasonId: workLog.cropSeasonId,
              type: this.mapWorkLogCostType(workLog.type),
              amount: dto.cost,
              occurredDate: workLog.workDate,
              sourceType: 'WORK_LOG',
              sourceId: workLog.id,
              sourceRecordId: workLog.id,
              remark: `农事自动成本：${workLog.type}`
            }
          });
        }
      }
      await tx.operationLog.create({
        data: {
          userId: this.operationLogService.getCurrentUserId(),
          action: 'CREATE_WORK_LOG',
          targetType: 'WORK_LOG',
          targetId: workLog.id,
          description: `添加农事记录：${workLog.type}`,
          metadata: { fieldId: workLog.fieldId, cropSeasonId: workLog.cropSeasonId }
        }
      });
      return workLog;
    });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.cropSeasonId ? { cropSeasonId: query.cropSeasonId } : {}),
      ...(query.keyword ? { workerName: { contains: query.keyword } } : {}),
      ...this.farmScope()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { field: true, cropSeason: true } }),
      this.prisma.workLog.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const workLog = await this.prisma.workLog.findUnique({ where: { id }, include: { field: true, cropSeason: true } });
    if (!workLog) {
      throw new NotFoundException('Work log not found');
    }
    return workLog;
  }

  update(id: string, dto: UpdateWorkLogDto) {
    return this.prisma.workLog.update({ where: { id }, data: this.toPrismaData(dto) });
  }

  remove(id: string) {
    return this.prisma.workLog.delete({ where: { id } });
  }

  private toPrismaData(dto: CreateWorkLogDto | UpdateWorkLogDto) {
    return removeUndefined({
      fieldId: dto.fieldId,
      cropSeasonId: dto.cropSeasonId,
      type: dto.type,
      workDate: dateOrUndefined(dto.workDate),
      workerName: dto.workerName,
      farmInputRefs: dto.farmInputIds,
      areaMu: dto.areaMu,
      laborHours: dto.laborHours,
      cost: dto.cost,
      imageUrls: dto.imageUrls,
      remark: dto.remark
    });
  }

  private mapWorkLogCostType(type: string) {
    const map: Record<string, 'DRONE' | 'MACHINERY' | 'LABOR' | 'IRRIGATION' | 'OTHER'> = {
      DRONE: 'DRONE',
      MACHINERY: 'MACHINERY',
      LABOR: 'LABOR',
      WATERING: 'IRRIGATION'
    };
    return map[type] ?? 'OTHER';
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { field: { farmId } } : {};
  }
}
