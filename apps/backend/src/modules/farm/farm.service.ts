import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

@Injectable()
export class FarmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  create(dto: CreateFarmDto) {
    const tenantId = this.requestContext.isPlatformAdmin() ? undefined : this.requestContext.getTenantId();
    return this.prisma.farm.create({ data: { ...dto, tenantId } });
  }

  findAll() {
    return this.prisma.farm.findMany({ where: this.scopeWhere(), orderBy: { createdAt: 'desc' }, include: { fields: true } });
  }

  async findOne(id: string) {
    const farm = await this.prisma.farm.findFirst({ where: { id, ...this.scopeWhere() }, include: { users: true, fields: true } });
    if (!farm) throw new NotFoundException('Farm not found');
    return farm;
  }

  async update(id: string, dto: UpdateFarmDto) {
    await this.assertInScope(id);
    return this.prisma.farm.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertInScope(id);
    return this.prisma.farm.delete({ where: { id } });
  }

  private scopeWhere() {
    if (this.requestContext.isPlatformAdmin()) return {};
    const tenantId = this.requestContext.getTenantId();
    return tenantId ? { tenantId } : { id: '__no_farm_scope__' };
  }

  private async assertInScope(id: string) {
    const farm = await this.prisma.farm.findFirst({ where: { id, ...this.scopeWhere() }, select: { id: true } });
    if (!farm) throw new NotFoundException('Farm not found');
  }
}
