import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';

@Injectable()
export class ServiceProviderService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateServiceProviderDto) {
    return this.prisma.serviceProvider.create({ data: dto });
  }

  findAll() {
    return this.prisma.serviceProvider.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const serviceProvider = await this.prisma.serviceProvider.findUnique({ where: { id } });
    if (!serviceProvider) {
      throw new NotFoundException('Service provider not found');
    }
    return serviceProvider;
  }

  update(id: string, dto: UpdateServiceProviderDto) {
    return this.prisma.serviceProvider.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.serviceProvider.delete({ where: { id } });
  }
}
