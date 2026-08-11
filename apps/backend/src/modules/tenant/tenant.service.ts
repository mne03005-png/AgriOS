import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  create(dto: CreateTenantDto) {
    this.assertPlatformManagement();
    return (this.prisma as any).tenant.create({ data: dto });
  }

  async findAll() {
    this.assertPlatformManagement();
    return (this.prisma as any).tenant.findMany({ where: {}, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    this.assertPlatformManagement();
    const tenant = await (this.prisma as any).tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    this.assertPlatformManagement();
    await this.findOne(id);
    return (this.prisma as any).tenant.update({ where: { id }, data: dto });
  }

  private assertPlatformManagement() {
    if (!this.requestContext.isPlatformAdmin()) throw new ForbiddenException('Platform tenant management permission required');
  }
}
