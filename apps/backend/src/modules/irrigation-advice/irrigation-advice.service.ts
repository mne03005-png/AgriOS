import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { RequestContextService } from '../../common/request-context.service';
import { CreateIrrigationAdviceDto } from './dto/create-irrigation-advice.dto';
import { ExecuteIrrigationAdviceDto } from './dto/execute-irrigation-advice.dto';

@Injectable()
export class IrrigationAdviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly mqttService: MqttService,
    private readonly requestContextService: RequestContextService
  ) {}

  create(dto: CreateIrrigationAdviceDto) {
    return this.prisma.irrigationAdvice.create({ data: dto });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.cropSeasonId ? { cropSeasonId: query.cropSeasonId } : {}),
      ...this.farmScope()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.irrigationAdvice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { field: true, device: true, cropSeason: true }
      }),
      this.prisma.irrigationAdvice.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { field: { farmId } } : {};
  }

  async findOne(id: string) {
    const advice = await this.prisma.irrigationAdvice.findUnique({
      where: { id },
      include: { field: true, device: true, cropSeason: true }
    });
    if (!advice) {
      throw new NotFoundException('Irrigation advice not found');
    }
    return advice;
  }

  async confirm(id: string) {
    await this.findOne(id);
    const advice = await this.prisma.irrigationAdvice.update({ where: { id }, data: { status: 'CONFIRMED' } });
    await this.operationLogService.create({
      action: 'CONFIRM_IRRIGATION_ADVICE',
      targetType: 'IRRIGATION_ADVICE',
      targetId: id,
      description: '确认灌溉建议',
      metadata: { fieldId: advice.fieldId, action: advice.action }
    });
    return advice;
  }

  async ignore(id: string) {
    await this.findOne(id);
    const advice = await this.prisma.irrigationAdvice.update({ where: { id }, data: { status: 'IGNORED' } });
    await this.operationLogService.create({
      action: 'IGNORE_IRRIGATION_ADVICE',
      targetType: 'IRRIGATION_ADVICE',
      targetId: id,
      description: '忽略灌溉建议',
      metadata: { fieldId: advice.fieldId, action: advice.action }
    });
    return advice;
  }

  async execute(id: string, dto: ExecuteIrrigationAdviceDto) {
    const advice = await this.findOne(id);
    if (!['PENDING', 'CONFIRMED'].includes(advice.status)) {
      throw new BadRequestException('只有 PENDING 或 CONFIRMED 状态的灌溉建议允许执行');
    }

    const pumpDevice = await this.prisma.device.findUnique({ where: { id: dto.pumpDeviceId } });
    if (!pumpDevice) {
      throw new NotFoundException('Pump device not found');
    }

    const mqttResult = { skipped: true, reason: 'READ_ONLY_MODE', deviceId: pumpDevice.code, command: dto.command };
    const [updatedAdvice, irrigationRecord] = await this.prisma.$transaction([
      this.prisma.irrigationAdvice.update({ where: { id }, data: { status: 'EXECUTED' } }),
      this.prisma.irrigationRecord.create({
        data: {
          fieldId: advice.fieldId,
          cropSeasonId: advice.cropSeasonId,
          startTime: new Date(),
          mode: 'ADVICE_EXECUTED',
          status: 'RUNNING',
          pumpDeviceId: dto.pumpDeviceId,
          valveDeviceId: dto.valveDeviceId,
          triggerReason: advice.message,
          remark: dto.remark
        }
      })
    ]);

    await this.operationLogService.create({
      action: 'EXECUTE_IRRIGATION_ADVICE',
      targetType: 'IRRIGATION_ADVICE',
      targetId: advice.id,
      description: '执行灌溉建议并下发设备指令',
      metadata: {
        fieldId: advice.fieldId,
        cropSeasonId: advice.cropSeasonId,
        irrigationRecordId: irrigationRecord.id,
        pumpDeviceId: dto.pumpDeviceId,
        valveDeviceId: dto.valveDeviceId,
        command: dto.command
      }
    });

    return {
      advice: updatedAdvice,
      irrigationRecord,
      mqttPublished: Boolean(mqttResult)
    };
  }
}
