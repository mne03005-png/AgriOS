import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { dateOrUndefined, removeUndefined } from '../../common/prisma-data.helpers';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { CreateSensorRecordDto } from './dto/create-sensor-record.dto';
import { UpdateSensorRecordDto } from './dto/update-sensor-record.dto';

@Injectable()
export class SensorRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService
  ) {}

  create(dto: CreateSensorRecordDto) {
    return this.prisma.sensorRecord.create({ data: this.toPrismaData(dto) as any });
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...this.farmScope()
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sensorRecord.findMany({ where, skip, take, orderBy: { reportedAt: 'desc' }, include: { device: true, field: true } }),
      this.prisma.sensorRecord.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const sensorRecord = await this.prisma.sensorRecord.findUnique({ where: { id }, include: { device: true, field: true } });
    if (!sensorRecord) {
      throw new NotFoundException('Sensor record not found');
    }
    return sensorRecord;
  }

  update(id: string, dto: UpdateSensorRecordDto) {
    return this.prisma.sensorRecord.update({ where: { id }, data: this.toPrismaData(dto) as any });
  }

  remove(id: string) {
    return this.prisma.sensorRecord.delete({ where: { id } });
  }

  private toPrismaData(dto: CreateSensorRecordDto | UpdateSensorRecordDto) {
    return removeUndefined({
      ...dto,
      reportedAt: dateOrUndefined(dto.reportedAt)
    });
  }

  private farmScope() {
    const farmId = this.requestContextService.isPlatformAdmin() ? undefined : this.requestContextService.getFarmId();
    return farmId ? { field: { farmId } } : {};
  }
}
