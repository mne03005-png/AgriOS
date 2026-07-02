import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

@Injectable()
export class FarmService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFarmDto) {
    return this.prisma.farm.create({ data: dto });
  }

  findAll() {
    return this.prisma.farm.findMany({ orderBy: { createdAt: 'desc' }, include: { fields: true } });
  }

  findOne(id: string) {
    return this.prisma.farm.findUnique({ where: { id }, include: { users: true, fields: true } });
  }

  update(id: string, dto: UpdateFarmDto) {
    return this.prisma.farm.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.farm.delete({ where: { id } });
  }
}
