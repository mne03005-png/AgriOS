import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { MqttService } from '../mqtt/mqtt.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { CreateIrrigationDto } from './dto/create-irrigation.dto';
import { CancelIrrigationDto } from './dto/cancel-irrigation.dto';
import { FinishIrrigationDto } from './dto/finish-irrigation.dto';
import { UpdateIrrigationDto } from './dto/update-irrigation.dto';

@Injectable()
export class IrrigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  async create(dto: CreateIrrigationDto) {
    await this.assertFieldInScope(dto.fieldId);
    if (dto.cropSeasonId) await this.assertCropSeasonInScope(dto.cropSeasonId);
    return this.prisma.irrigationRecord.create({ data: { ...this.toPrismaData(dto), ...this.tenantData() } as any });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.cropSeasonId ? { cropSeasonId: query.cropSeasonId } : {}),
      ...this.farmScope(),
      ...this.tenantWhere()
    };
    const include = { field: true, cropSeason: true, pumpDevice: true, valveDevice: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.irrigationRecord.findMany({ where, skip, take, orderBy: { startTime: 'desc' }, include }),
      this.prisma.irrigationRecord.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const irrigationRecord = await this.prisma.irrigationRecord.findFirst({
      where: { id, ...this.tenantWhere() },
      include: { field: true, cropSeason: true, pumpDevice: true, valveDevice: true }
    });
    if (!irrigationRecord) {
      throw new NotFoundException('Irrigation record not found');
    }
    return irrigationRecord;
  }

  async update(id: string, dto: UpdateIrrigationDto) {
    await this.assertInScope(id);
    if (dto.fieldId) await this.assertFieldInScope(dto.fieldId);
    if (dto.cropSeasonId) await this.assertCropSeasonInScope(dto.cropSeasonId);
    return this.prisma.irrigationRecord.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  async remove(id: string) {
    await this.assertInScope(id);
    return this.prisma.irrigationRecord.delete({ where: { id } });
  }

  async finish(id: string, dto: FinishIrrigationDto) {
    const irrigationRecord = await this.findOne(id);
    let mqttResult: { skipped: boolean; reason: string; deviceId?: string } | null = null;
    if (irrigationRecord.pumpDevice) {
      mqttResult = { skipped: true, reason: 'READ_ONLY_MODE', deviceId: irrigationRecord.pumpDevice.code };
    }

    const updated = await this.prisma.irrigationRecord.update({
      where: { id },
      data: {
        endTime: new Date(),
        status: 'FINISHED',
        waterAmount: dto.waterAmount,
        remark: dto.remark ?? irrigationRecord.remark
      },
      include: { field: true, cropSeason: true, pumpDevice: true, valveDevice: true }
    });

    await this.operationLogService.create({
      action: 'FINISH_IRRIGATION_RECORD',
      targetType: 'IRRIGATION_RECORD',
      targetId: id,
      description: '结束灌溉记录',
      metadata: {
        fieldId: updated.fieldId,
        cropSeasonId: updated.cropSeasonId,
        waterAmount: dto.waterAmount,
        mqttPublished: Boolean(mqttResult)
      }
    });

    return {
      irrigationRecord: updated,
      mqttPublished: Boolean(mqttResult)
    };
  }

  async cancel(id: string, dto: CancelIrrigationDto) {
    const irrigationRecord = await this.findOne(id);
    let mqttResult: { skipped: boolean; reason: string; deviceId?: string } | null = null;
    if (irrigationRecord.pumpDevice) {
      mqttResult = { skipped: true, reason: 'READ_ONLY_MODE', deviceId: irrigationRecord.pumpDevice.code };
    }

    const updated = await this.prisma.irrigationRecord.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        endTime: new Date(),
        remark: dto.reason
      },
      include: { field: true, cropSeason: true, pumpDevice: true, valveDevice: true }
    });

    await this.operationLogService.create({
      action: 'CANCEL_IRRIGATION_RECORD',
      targetType: 'IRRIGATION_RECORD',
      targetId: id,
      description: '取消灌溉记录',
      metadata: {
        fieldId: updated.fieldId,
        cropSeasonId: updated.cropSeasonId,
        reason: dto.reason,
        mqttPublished: Boolean(mqttResult)
      }
    });

    return {
      irrigationRecord: updated,
      mqttPublished: Boolean(mqttResult)
    };
  }

  private toPrismaData(dto: CreateIrrigationDto | UpdateIrrigationDto) {
    return removeUndefined({
      ...dto,
      startTime: dateOrUndefined(dto.startTime),
      endTime: dateOrUndefined(dto.endTime)
    });
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { field: { farmId } } : {};
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
    const item = await this.prisma.irrigationRecord.findFirst({ where: { id, ...this.tenantWhere() }, select: { id: true } });
    if (!item) throw new NotFoundException('Irrigation record not found');
  }

  private async assertFieldInScope(fieldId: string) {
    if (this.requestContextService.isPlatformAdmin()) return;
    const field = await this.prisma.field.findFirst({ where: { id: fieldId, tenantId: this.requestContextService.getTenantId() }, select: { id: true } });
    if (!field) throw new NotFoundException('Field not found');
  }

  private async assertCropSeasonInScope(cropSeasonId: string) {
    if (this.requestContextService.isPlatformAdmin()) return;
    const cropSeason = await this.prisma.cropSeason.findFirst({ where: { id: cropSeasonId, tenantId: this.requestContextService.getTenantId() }, select: { id: true } });
    if (!cropSeason) throw new NotFoundException('Crop season not found');
  }
}
