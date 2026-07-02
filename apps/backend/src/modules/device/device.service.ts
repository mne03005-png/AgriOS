import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { MqttService } from '../mqtt/mqtt.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
    private readonly operationLogService: OperationLogService,
    private readonly requestContextService: RequestContextService
  ) {}

  create(dto: CreateDeviceDto) {
    return this.prisma.device.create({ data: this.toPrismaData(dto) as any });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } : {}),
      ...this.farmScope()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.device.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { field: true } }),
      this.prisma.device.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { field: { farmId } } : {};
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, include: { field: true, sensorRecords: true } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  update(id: string, dto: UpdateDeviceDto) {
    return this.prisma.device.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  remove(id: string) {
    return this.prisma.device.delete({ where: { id } });
  }

  async sendCommand(id: string, command: 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE') {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const requestId = randomUUID();
    const topic = `agrios/device/${device.code}/command`;
    const deviceCommand = await (this.prisma as any).deviceCommand.create({
      data: {
        deviceId: device.id,
        command,
        payload: { command, requestId },
        status: 'PENDING',
        mqttTopic: topic,
        requestId
      }
    });

    const result = this.mqttService.publishCommand({ deviceId: device.code, command, requestId });
    const sentCommand = await (this.prisma as any).deviceCommand.update({
      where: { id: deviceCommand.id },
      data: { status: 'SENT', sentAt: new Date() }
    });

    await this.operationLogService.create({
      action: 'SEND_DEVICE_COMMAND',
      targetType: 'DEVICE',
      targetId: device.id,
      description: `下发设备指令：${command}`,
      metadata: { fieldId: device.fieldId, deviceCode: device.code, command, requestId, deviceCommandId: deviceCommand.id }
    });

    return {
      device,
      deviceCommand: sentCommand,
      command,
      result
    };
  }

  private toPrismaData(dto: CreateDeviceDto | UpdateDeviceDto) {
    return removeUndefined({
      ...dto,
      lastReportedAt: dateOrUndefined(dto.lastReportedAt)
    });
  }
}
