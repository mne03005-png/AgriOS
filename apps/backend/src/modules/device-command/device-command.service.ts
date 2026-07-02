import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DeviceCommandService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = query.keyword ? { command: { contains: query.keyword } } : {};
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).deviceCommand.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { device: true } }),
      (this.prisma as any).deviceCommand.count({ where })
    ]);
    return paginatedResult(items, page, pageSize, total);
  }

  async findOne(id: string) {
    const command = await (this.prisma as any).deviceCommand.findUnique({ where: { id }, include: { device: true } });
    if (!command) {
      throw new NotFoundException('Device command not found');
    }
    return command;
  }
}
