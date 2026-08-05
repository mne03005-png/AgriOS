import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSensorRecordDto } from './dto/create-sensor-record.dto';
import { UpdateSensorRecordDto } from './dto/update-sensor-record.dto';

const safeSensorRecordSelect = {
  id: true,
  tenantId: true,
  farmId: true,
  deviceId: true,
  device: true,
  fieldId: true,
  field: true,
  eventId: true,
  deviceName: true,
  thingsboardDeviceId: true,
  type: true,
  value: true,
  unit: true,
  soilMoisture: true,
  temperature: true,
  humidity: true,
  battery: true,
  normalizedJson: true,
  source: true,
  reportedAt: true,
  receivedAt: true,
  qualityStatus: true,
  qualityScore: true,
  createdAt: true
};

@Injectable()
export class SensorRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantScope: TenantScopeService
  ) {}

  async create(dto: CreateSensorRecordDto) {
    await this.assertRelationsInScope(dto);
    return this.prisma.sensorRecord.create({ data: this.tenantScope.createData(this.toPrismaData(dto)) as any, select: safeSensorRecordSelect });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = this.tenantScope.where({
      ...(query.fieldId ? { fieldId: query.fieldId } : {})
    });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sensorRecord.findMany({ where, skip, take, orderBy: { reportedAt: 'desc' }, select: safeSensorRecordSelect }),
      this.prisma.sensorRecord.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const sensorRecord = await this.prisma.sensorRecord.findFirst({ where: this.tenantScope.where({ id }), select: safeSensorRecordSelect });
    if (!sensorRecord) throw new NotFoundException('Sensor record not found');
    return sensorRecord;
  }

  async update(id: string, dto: UpdateSensorRecordDto) {
    await this.assertSensorRecordInScope(id);
    await this.assertRelationsInScope(dto);
    return this.prisma.sensorRecord.update({ where: { id }, data: this.toPrismaData(dto) as any, select: safeSensorRecordSelect });
  }

  async remove(id: string) {
    await this.assertSensorRecordInScope(id);
    return this.prisma.sensorRecord.delete({ where: { id }, select: safeSensorRecordSelect });
  }

  private async assertSensorRecordInScope(id: string) {
    const sensorRecord = await this.prisma.sensorRecord.findFirst({ where: this.tenantScope.where({ id }), select: { id: true } });
    if (!sensorRecord) throw new NotFoundException('Sensor record not found');
  }

  private async assertRelationsInScope(dto: CreateSensorRecordDto | UpdateSensorRecordDto) {
    if (dto.fieldId) {
      const field = await this.prisma.field.findFirst({ where: this.tenantScope.where({ id: dto.fieldId }), select: { id: true, farmId: true } });
      if (!field) throw new NotFoundException('Field not found');
    }
    if (dto.deviceId) {
      const device = await this.prisma.device.findFirst({ where: this.tenantScope.where({ id: dto.deviceId }), select: { id: true } });
      if (!device) throw new NotFoundException('Device not found');
    }
  }

  private toPrismaData(dto: CreateSensorRecordDto | UpdateSensorRecordDto) {
    const { tenantId: _tenantId, rawPayload: _rawPayload, ...input } = dto as any;
    return removeUndefined({
      ...input,
      reportedAt: dateOrUndefined(input.reportedAt)
    });
  }
}
