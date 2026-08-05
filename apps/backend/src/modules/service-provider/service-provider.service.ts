import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';

@Injectable()
export class ServiceProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantScope: TenantScopeService
  ) {}

  create(dto: CreateServiceProviderDto) {
    return this.prisma.serviceProvider.create({ data: this.tenantScope.createData(dto as any) as any });
  }

  findAll() {
    return this.prisma.serviceProvider.findMany({ where: this.tenantScope.where(), orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const serviceProvider = await this.prisma.serviceProvider.findFirst({ where: this.tenantScope.where({ id }) });
    if (!serviceProvider) throw new NotFoundException('Service provider not found');
    return serviceProvider;
  }

  async update(id: string, dto: UpdateServiceProviderDto) {
    await this.assertInScope(id);
    return this.prisma.serviceProvider.update({ where: { id }, data: this.tenantScope.createData(dto as any) as any });
  }

  async remove(id: string) {
    await this.assertInScope(id);
    return this.prisma.serviceProvider.delete({ where: { id } });
  }

  private async assertInScope(id: string) {
    const serviceProvider = await this.prisma.serviceProvider.findFirst({ where: this.tenantScope.where({ id }), select: { id: true } });
    if (!serviceProvider) throw new NotFoundException('Service provider not found');
  }
}
