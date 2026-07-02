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

  create(dto: CreateIrrigationDto) {
    return this.prisma.irrigationRecord.create({ data: this.toPrismaData(dto) as any });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.cropSeasonId ? { cropSeasonId: query.cropSeasonId } : {}),
      ...this.farmScope()
    };
    const include = { field: true, cropSeason: true, pumpDevice: true, valveDevice: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.irrigationRecord.findMany({ where, skip, take, orderBy: { startTime: 'desc' }, include }),
      this.prisma.irrigationRecord.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const irrigationRecord = await this.prisma.irrigationRecord.findUnique({
      where: { id },
      include: { field: true, cropSeason: true, pumpDevice: true, valveDevice: true }
    });
    if (!irrigationRecord) {
      throw new NotFoundException('Irrigation record not found');
    }
    return irrigationRecord;
  }

  update(id: string, dto: UpdateIrrigationDto) {
    return this.prisma.irrigationRecord.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  remove(id: string) {
    return this.prisma.irrigationRecord.delete({ where: { id } });
  }

  async finish(id: string, dto: FinishIrrigationDto) {
    const irrigationRecord = await this.findOne(id);
    let mqttResult: { topic: string; message: string } | null = null;
    if (irrigationRecord.pumpDevice) {
      mqttResult = this.mqttService.publishCommand({ deviceId: irrigationRecord.pumpDevice.code, command: 'PUMP_OFF' });
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
    let mqttResult: { topic: string; message: string } | null = null;
    if (irrigationRecord.pumpDevice) {
      mqttResult = this.mqttService.publishCommand({ deviceId: irrigationRecord.pumpDevice.code, command: 'PUMP_OFF' });
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
}
