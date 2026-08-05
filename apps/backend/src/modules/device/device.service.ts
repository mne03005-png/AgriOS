import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

const safeDeviceSelect = {
  id: true,
  tenantId: true,
  fieldId: true,
  field: true,
  code: true,
  name: true,
  type: true,
  thingsboardDeviceId: true,
  iotStatus: true,
  bindingSource: true,
  mqttTopic: true,
  online: true,
  currentStatus: true,
  lastReportedAt: true,
  lastTelemetryAt: true,
  remark: true,
  createdAt: true,
  updatedAt: true
};

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantScope: TenantScopeService
  ) {}

  async create(dto: CreateDeviceDto) {
    await this.assertFieldInScope(dto.fieldId);
    return this.prisma.device.create({ data: this.tenantScope.createData(this.toPrismaData(dto)) as any, select: safeDeviceSelect });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = this.tenantScope.where({
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } : {})
    });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.device.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: safeDeviceSelect }),
      this.prisma.device.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findFirst({ where: this.tenantScope.where({ id }), select: safeDeviceSelect });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto) {
    await this.assertDeviceInScope(id);
    if (dto.fieldId) await this.assertFieldInScope(dto.fieldId);
    return this.prisma.device.update({ where: { id }, data: this.toPrismaData(dto) as any, select: safeDeviceSelect });
  }

  async remove(id: string) {
    await this.assertDeviceInScope(id);
    return this.prisma.device.delete({ where: { id }, select: safeDeviceSelect });
  }

  sendCommand(_id?: string, _command?: string) {
    throw new GoneException('Legacy device command endpoint is disabled. Use the protected device-control API.');
  }

  private async assertDeviceInScope(id: string) {
    const device = await this.prisma.device.findFirst({ where: this.tenantScope.where({ id }), select: { id: true } });
    if (!device) throw new NotFoundException('Device not found');
  }

  private async assertFieldInScope(fieldId?: string | null) {
    if (!fieldId) return;
    const field = await this.prisma.field.findFirst({ where: this.tenantScope.where({ id: fieldId }), select: { id: true } });
    if (!field) throw new NotFoundException('Field not found');
  }

  private toPrismaData(dto: CreateDeviceDto | UpdateDeviceDto) {
    const { tenantId: _tenantId, thingsboardAccessToken: _thingsboardAccessToken, ...input } = dto as any;
    return removeUndefined({
      ...input,
      lastReportedAt: dateOrUndefined(input.lastReportedAt)
    });
  }
}
