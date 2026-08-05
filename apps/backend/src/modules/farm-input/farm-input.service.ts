import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateFarmInputDto } from './dto/create-farm-input.dto';
import { UpdateFarmInputDto } from './dto/update-farm-input.dto';

@Injectable()
export class FarmInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  async create(dto: CreateFarmInputDto) {
    await this.assertCropSeasonInScope(dto.cropSeasonId);
    return this.prisma.$transaction(async (tx: any) => {
      const farmInput = await tx.farmInput.create({ data: { ...this.toPrismaData(dto), ...this.tenantData() }, include: { cropSeason: true } });
      if (dto.totalPrice && dto.totalPrice > 0) {
        const existingCost = await tx.costRecord.findFirst({ where: { sourceRecordId: farmInput.id } });
        if (!existingCost) {
          await tx.costRecord.create({
            data: {
              cropSeasonId: farmInput.cropSeasonId,
              tenantId: farmInput.tenantId,
              type: this.mapFarmInputCostType(farmInput.type),
              amount: dto.totalPrice,
              occurredDate: farmInput.purchaseDate ?? farmInput.usedDate ?? new Date(),
              sourceType: 'FARM_INPUT',
              sourceId: farmInput.id,
              sourceRecordId: farmInput.id,
              remark: `农资自动成本：${farmInput.name}`
            }
          });
        }
      }
      await tx.operationLog.create({
        data: {
          userId: this.operationLogService.getCurrentUserId(),
          action: 'CREATE_FARM_INPUT',
          targetType: 'FARM_INPUT',
          targetId: farmInput.id,
          description: `添加农资：${farmInput.name}`,
          metadata: { fieldId: farmInput.cropSeason.fieldId, cropSeasonId: farmInput.cropSeasonId }
        }
      });
      return farmInput;
    });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.cropSeasonId ? { cropSeasonId: query.cropSeasonId } : {}),
      ...(query.keyword ? { name: { contains: query.keyword } } : {}),
      ...this.farmScope(),
      ...this.tenantWhere()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.farmInput.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { cropSeason: true } }),
      this.prisma.farmInput.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const farmInput = await this.prisma.farmInput.findFirst({ where: { id, ...this.tenantWhere() }, include: { cropSeason: true } });
    if (!farmInput) {
      throw new NotFoundException('Farm input not found');
    }
    return farmInput;
  }

  async update(id: string, dto: UpdateFarmInputDto) {
    await this.assertInScope(id);
    if (dto.cropSeasonId) await this.assertCropSeasonInScope(dto.cropSeasonId);
    return this.prisma.farmInput.update({ where: { id }, data: this.toPrismaData(dto) });
  }

  async remove(id: string) {
    await this.assertInScope(id);
    return this.prisma.farmInput.delete({ where: { id } });
  }

  private toPrismaData(dto: CreateFarmInputDto | UpdateFarmInputDto) {
    return removeUndefined({
      ...dto,
      purchaseDate: dateOrUndefined(dto.purchaseDate),
      usedDate: dateOrUndefined(dto.usedDate)
    });
  }

  private mapFarmInputCostType(type: string) {
    const map: Record<string, 'SEED' | 'FERTILIZER' | 'PESTICIDE' | 'OTHER'> = {
      SEED: 'SEED',
      FERTILIZER: 'FERTILIZER',
      PESTICIDE: 'PESTICIDE',
      FILM: 'OTHER',
      IRRIGATION_MATERIAL: 'OTHER',
      OTHER: 'OTHER'
    };
    return map[type] ?? 'OTHER';
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { cropSeason: { field: { farmId } } } : {};
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
    const item = await this.prisma.farmInput.findFirst({ where: { id, ...this.tenantWhere() }, select: { id: true } });
    if (!item) throw new NotFoundException('Farm input not found');
  }

  private async assertCropSeasonInScope(cropSeasonId: string) {
    if (this.requestContextService.isPlatformAdmin()) return;
    const cropSeason = await this.prisma.cropSeason.findFirst({ where: { id: cropSeasonId, tenantId: this.requestContextService.getTenantId() }, select: { id: true } });
    if (!cropSeason) throw new NotFoundException('Crop season not found');
  }
}
