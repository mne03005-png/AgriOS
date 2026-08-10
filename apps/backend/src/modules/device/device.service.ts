import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService, private readonly requestContextService: RequestContextService) {}

  create(dto: CreateDeviceDto) { return this.prisma.device.create({ data: this.toPrismaData(dto) as any }); }

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
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  update(id: string, dto: UpdateDeviceDto) { return this.prisma.device.update({ where: { id }, data: this.toPrismaData(dto) as any }); }
  remove(id: string) { return this.prisma.device.delete({ where: { id } }); }

  async sendCommand(id: string, command: 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE') {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    throw new BadRequestException({
      errorCode: 'ACTION_QUEUE_PATH_REQUIRED',
      message: 'Physical commands must enter through Safety, Approval, ActionPlan and ActionQueue',
      deviceId: device.id,
      command
    });
  }

  private toPrismaData(dto: CreateDeviceDto | UpdateDeviceDto) {
    return removeUndefined({ ...dto, lastReportedAt: dateOrUndefined(dto.lastReportedAt) });
  }
}
