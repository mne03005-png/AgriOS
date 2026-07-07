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
    await this.assertFieldInScope(dto.fieldId);
    const cropSeason = await this.prisma.cropSeason.create({ data: { ...this.toPrismaData(dto), ...this.tenantData() } as any });
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
      ...this.tenantWhere()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cropSeason.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { field: true } }),
      this.prisma.cropSeason.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const cropSeason = await this.prisma.cropSeason.findFirst({
      where: { id, ...this.tenantWhere() },
      include: { field: true, farmInputs: true, workLogs: true, irrigationRecords: true, costRecords: true }
    });
    if (!cropSeason) {
      throw new NotFoundException('Crop season not found');
    }
    return cropSeason;
  }

  async update(id: string, dto: UpdateCropSeasonDto) {
    await this.assertInScope(id);
    if (dto.fieldId) await this.assertFieldInScope(dto.fieldId);
    return this.prisma.cropSeason.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  async remove(id: string) {
    await this.assertInScope(id);
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

  private tenantWhere() {
    if (this.requestContextService.isPlatformAdmin()) return {};
    const tenantId = this.requestContextService.getTenantId();
    return tenantId ? { tenantId } : { id: '__missing_tenant__' };
  }

  private tenantData() {
    if (this.requestContextService.isPlatformAdmin()) return {};
    return { tenantId: this.requestContextService.getTenantId() };
  }

  private async assertInScope(id: string) {
    const item = await this.prisma.cropSeason.findFirst({ where: { id, ...this.tenantWhere() }, select: { id: true } });
    if (!item) throw new NotFoundException('Crop season not found');
  }

  private async assertFieldInScope(fieldId: string) {
    if (this.requestContextService.isPlatformAdmin()) return;
    const field = await this.prisma.field.findFirst({ where: { id: fieldId, tenantId: this.requestContextService.getTenantId() }, select: { id: true } });
    if (!field) throw new NotFoundException('Field not found');
  }
}
