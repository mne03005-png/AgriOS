import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { getPagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateCropSeasonDto } from './dto/create-crop-season.dto';
import { UpdateCropSeasonDto } from './dto/update-crop-season.dto';

@Injectable()
export class CropSeasonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  async create(dto: CreateCropSeasonDto) {
    const cropSeason = await this.prisma.cropSeason.create({ data: this.toPrismaData(dto) as any });
    await this.operationLogService.create({
      action: 'CREATE_CROP_SEASON',
      targetType: 'CROP_SEASON',
      targetId: cropSeason.id,
      description: `创建种植季：${cropSeason.cropName}`,
      metadata: { fieldId: cropSeason.fieldId, cropSeasonId: cropSeason.id }
    });
    return cropSeason;
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.keyword ? { cropName: { contains: query.keyword } } : {}),
      ...this.farmScope()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cropSeason.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { field: true } }),
      this.prisma.cropSeason.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const cropSeason = await this.prisma.cropSeason.findUnique({
      where: { id },
      include: { field: true, farmInputs: true, workLogs: true, irrigationRecords: true, costRecords: true }
    });
    if (!cropSeason) {
      throw new NotFoundException('Crop season not found');
    }
    return cropSeason;
  }

  update(id: string, dto: UpdateCropSeasonDto) {
    return this.prisma.cropSeason.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  remove(id: string) {
    return this.prisma.cropSeason.delete({ where: { id } });
  }

  private toPrismaData(dto: CreateCropSeasonDto | UpdateCropSeasonDto) {
    return removeUndefined({
      fieldId: dto.fieldId,
      cropName: dto.cropName,
      variety: dto.variety,
      year: dto.year,
      season: dto.season,
      sowingDate: dateOrUndefined(dto.sowingDate),
      expectedHarvestAt: dateOrUndefined(dto.expectedHarvestDate),
      actualHarvestAt: dateOrUndefined(dto.actualHarvestDate),
      managerName: dto.managerName,
      status: dto.status,
      remark: dto.remark
    });
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { field: { farmId } } : {};
  }
}
