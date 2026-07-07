import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';

@Injectable()
export class FieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  async create(dto: CreateFieldDto) {
    const farmId = this.requestContextService.isPlatformAdmin() ? dto.farmId : this.requestContextService.getFarmId() ?? dto.farmId;
    await this.assertCanAccessFarmRecord(farmId);
    const tenantId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getTenantId();
    const field = await this.prisma.field.create({ data: { ...dto, farmId, tenantId } });
    await this.operationLogService.create({
      action: 'CREATE_FIELD',
      targetType: 'FIELD',
      targetId: field.id,
      description: `创建地块：${field.name}`,
      metadata: { fieldId: field.id, farmId: field.farmId }
    });
    return field;
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    const tenantId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getTenantId();
    const where = {
      ...(farmId ? { farmId } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(query.keyword
        ? {
            OR: [
            { name: { contains: query.keyword } },
            { location: { contains: query.keyword } },
            { lastYearCrop: { contains: query.keyword } }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.field.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { farm: true } }),
      this.prisma.field.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const field = await this.prisma.field.findFirst({
      where: { id, ...this.tenantWhere() },
      include: { farm: true, cropSeasons: true, devices: true }
    });
    if (!field) {
      throw new NotFoundException('Field not found');
    }
    this.assertCanAccessFarm(field.farmId);
    return field;
  }

  async update(id: string, dto: UpdateFieldDto) {
    await this.assertCanAccessField(id);
    return this.prisma.field.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertCanAccessField(id);
    return this.prisma.field.delete({ where: { id } });
  }

  async getSummary(id: string) {
    const field = await this.prisma.field.findFirst({
      where: { id, ...this.tenantWhere() },
      include: {
        farm: true,
        devices: true,
        cropSeasons: {
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
          take: 1
        }
      }
    });

    if (!field) {
      throw new NotFoundException('Field not found');
    }
    this.assertCanAccessFarm(field.farmId);

    const currentCropSeason = field.cropSeasons[0] ?? null;
    const [latestSoilMoisture, latestIrrigation, seasonCostTotal, pendingIrrigationAdviceCount, latestIrrigationAdvice] =
      await Promise.all([
        this.prisma.sensorRecord.findFirst({
          where: { fieldId: id, type: 'SOIL_MOISTURE' },
          orderBy: { reportedAt: 'desc' }
        }),
        this.prisma.irrigationRecord.findFirst({
          where: { fieldId: id },
          orderBy: { startTime: 'desc' },
          include: { pumpDevice: true, valveDevice: true }
        }),
        currentCropSeason
          ? this.prisma.costRecord.aggregate({
              where: { cropSeasonId: currentCropSeason.id, isReversed: false },
              _sum: { amount: true }
            })
          : Promise.resolve({ _sum: { amount: null } }),
        this.prisma.irrigationAdvice.count({ where: { fieldId: id, status: 'PENDING' } }),
        this.prisma.irrigationAdvice.findFirst({ where: { fieldId: id }, orderBy: { createdAt: 'desc' } })
      ]);

    const deviceOnlineCount = field.devices.filter((device: any) => device.online).length;
    const deviceOfflineCount = field.devices.length - deviceOnlineCount;
    const currentSeasonCostTotal = Number(seasonCostTotal._sum.amount ?? 0);

    return {
      field,
      currentCropSeason,
      latestSoilMoisture: latestSoilMoisture ? Number(latestSoilMoisture.value) : null,
      devices: field.devices,
      latestIrrigation,
      seasonCostTotal: currentSeasonCostTotal,
      currentSeasonCostTotal,
      pendingIrrigationAdviceCount,
      latestIrrigationAdvice,
      deviceOnlineCount,
      deviceOfflineCount,
      rotationWarning: this.buildRotationAdvice(field.lastYearCrop, currentCropSeason?.cropName)
    };
  }

  async getRotationAdvice(id: string) {
    const field = await this.prisma.field.findFirst({
      where: { id, ...this.tenantWhere() },
      include: {
        cropSeasons: {
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
          take: 1
        }
      }
    });

    if (!field) {
      throw new NotFoundException('Field not found');
    }
    this.assertCanAccessFarm(field.farmId);

    const currentCropSeason = field.cropSeasons[0] ?? null;
    return {
      fieldId: field.id,
      lastCrop: field.lastYearCrop,
      currentCrop: currentCropSeason?.cropName ?? null,
      advice: this.buildRotationAdvice(field.lastYearCrop, currentCropSeason?.cropName)
    };
  }

  async getTimeline(id: string, query: ListQueryDto = {}) {
    const field = await this.prisma.field.findFirst({ where: { id, ...this.tenantWhere() }, include: { farm: true } });
    if (!field) {
      throw new NotFoundException('Field not found');
    }
    this.assertCanAccessFarm(field.farmId);

    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const limit = Math.max(page * pageSize, pageSize);

    const [cropSeasons, farmInputs, workLogs, sensorRecords, irrigationRecords, irrigationAdvices, costRecords, operationLogs] =
      await Promise.all([
        this.prisma.cropSeason.findMany({ where: { fieldId: id }, orderBy: { createdAt: 'desc' }, take: limit }),
        this.prisma.farmInput.findMany({ where: { cropSeason: { fieldId: id } }, orderBy: { createdAt: 'desc' }, take: limit }),
        this.prisma.workLog.findMany({ where: { fieldId: id }, orderBy: { workDate: 'desc' }, take: limit }),
        this.prisma.sensorRecord.findMany({ where: { fieldId: id }, orderBy: { reportedAt: 'desc' }, take: Math.min(limit, 50), include: { device: true } }),
        this.prisma.irrigationRecord.findMany({ where: { fieldId: id }, orderBy: { startTime: 'desc' }, take: limit }),
        this.prisma.irrigationAdvice.findMany({ where: { fieldId: id }, orderBy: { createdAt: 'desc' }, take: limit }),
        this.prisma.costRecord.findMany({ where: { cropSeason: { fieldId: id } }, orderBy: { occurredDate: 'desc' }, take: limit }),
        this.prisma.operationLog.findMany({
          where: { OR: [{ targetType: 'FIELD', targetId: id }, { metadata: { path: '$.fieldId', equals: id } }] },
          orderBy: { createdAt: 'desc' },
          take: limit
        })
      ]);

    const items = [
      ...cropSeasons.map((item: any) => ({ type: 'CROP_SEASON', title: `种植季：${item.cropName}`, time: item.createdAt, data: item })),
      ...farmInputs.map((item: any) => ({ type: 'FARM_INPUT', title: `农资：${item.name}`, time: item.createdAt, data: item })),
      ...workLogs.map((item: any) => ({ type: 'WORK_LOG', title: `农事：${item.type}`, time: item.workDate, data: item })),
      ...sensorRecords.map((item: any) => ({ type: 'SENSOR_RECORD', title: `传感器：${item.type}`, time: item.reportedAt, data: item })),
      ...irrigationRecords.map((item: any) => ({ type: 'IRRIGATION_RECORD', title: `灌溉：${item.mode}`, time: item.startTime, data: item })),
      ...irrigationAdvices.map((item: any) => ({ type: 'IRRIGATION_ADVICE', title: `灌溉建议：${item.action}`, time: item.createdAt, data: item })),
      ...costRecords.map((item: any) => ({ type: 'COST_RECORD', title: `成本：${item.type}`, time: item.occurredDate, data: item })),
      ...operationLogs.map((item: any) => ({ type: 'OPERATION_LOG', title: item.description, time: item.createdAt, data: item }))
    ]
      .filter((item) => !query.type || item.type === query.type)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const start = (page - 1) * pageSize;
    return {
      field,
      items: items.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: items.length
      }
    };
  }

  private buildRotationAdvice(lastCrop?: string | null, currentCrop?: string | null) {
    if (!lastCrop || !currentCrop) {
      return '暂无足够轮作数据';
    }

    if (lastCrop === '洋葱' && currentCrop === '洋葱') {
      return '洋葱不建议连作，注意病害、土壤养分失衡，可考虑轮作';
    }

    if (lastCrop === currentCrop) {
      return `该地块去年种植${lastCrop}，今年不建议继续种植${currentCrop}`;
    }

    return '当前轮作风险较低';
  }

  private assertCanAccessFarm(farmId: string) {
    const currentFarmId = this.requestContextService.getFarmId();
    if (!this.requestContextService.isPlatformAdmin() && currentFarmId && currentFarmId !== farmId) {
      throw new NotFoundException('Field not found');
    }
  }

  private async assertCanAccessFarmRecord(farmId: string) {
    if (this.requestContextService.isPlatformAdmin()) return;
    const tenantId = this.requestContextService.getTenantId();
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId, tenantId }, select: { id: true } });
    if (!farm) throw new NotFoundException('Farm not found');
  }

  private async assertCanAccessField(id: string) {
    const tenantId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getTenantId();
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    const field = await this.prisma.field.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
        ...(farmId ? { farmId } : {})
      },
      select: { id: true }
    });
    if (!field) throw new NotFoundException('Field not found');
  }

  private tenantWhere() {
    if (this.requestContextService.isPlatformAdmin()) return {};
    const tenantId = this.requestContextService.getTenantId();
    return tenantId ? { tenantId } : { id: '__missing_tenant__' };
  }
}
