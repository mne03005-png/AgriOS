import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const safeUserSelect = {
  id: true,
  tenantId: true,
  phone: true,
  email: true,
  name: true,
  role: true,
  status: true,
  farmId: true,
  farm: true,
  remark: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly tenantScope: TenantScopeService
  ) {}

  create(dto: CreateUserDto) {
    this.assertCanManageUsers();
    return this.createWithTenant(dto);
  }

  findAll() {
    this.assertCanManageUsers();
    return this.prisma.user.findMany({ where: this.tenantScope.where(), orderBy: { createdAt: 'desc' }, select: safeUserSelect });
  }

  async findOne(id: string) {
    const currentUserId = this.requestContext.getUserId();
    if (id !== currentUserId) this.assertCanManageUsers();
    const user = await this.prisma.user.findFirst({ where: this.tenantScope.where({ id }), select: safeUserSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const currentUserId = this.requestContext.getUserId();
    const selfUpdate = id === currentUserId;
    if (!selfUpdate) this.assertCanManageUsers();
    const existing = await this.prisma.user.findFirst({ where: this.tenantScope.where({ id }), select: { id: true, tenantId: true } });
    if (!existing) throw new NotFoundException('User not found');
    const data = selfUpdate ? this.safeSelfUpdateData(dto) : await this.safeAdminUpdateData(dto, existing.tenantId);
    return this.prisma.user.update({ where: { id }, data, select: safeUserSelect });
  }

  async remove(id: string) {
    this.assertCanManageUsers();
    const existing = await this.prisma.user.findFirst({ where: this.tenantScope.where({ id }), select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.user.delete({ where: { id }, select: safeUserSelect });
  }

  private assertCanManageUsers() {
    const role = this.requestContext.getRole();
    if (!['PLATFORM_ADMIN', 'TENANT_ADMIN', 'COOPERATIVE_ADMIN'].includes(role ?? '')) {
      throw new ForbiddenException('User management requires an administrative role');
    }
  }

  private async createWithTenant(dto: CreateUserDto) {
    const data = await this.safeAdminCreateData(dto);
    return this.prisma.user.create({ data: data as any, select: safeUserSelect });
  }

  private safeSelfUpdateData(dto: UpdateUserDto) {
    const input = dto as any;
    const data: Record<string, unknown> = {
      phone: input.phone,
      email: input.email,
      name: input.name,
      remark: input.remark
    };
    return this.compact(data);
  }

  private async safeAdminCreateData(dto: CreateUserDto) {
    const input = dto as any;
    if (!this.requestContext.isPlatformAdmin() && input.role) {
      throw new ForbiddenException('Only platform administrators can assign user roles');
    }
    const tenantId = this.resolveTargetTenantId(input.tenantId);
    const data: Record<string, unknown> = {
      phone: input.phone,
      email: input.email,
      name: input.name,
      remark: input.remark,
      tenantId
    };
    if (this.requestContext.isPlatformAdmin()) {
      if (input.role) data.role = input.role;
      if (input.status) data.status = input.status;
    }
    if (input.farmId) {
      if (this.requestContext.isPlatformAdmin() && !tenantId) throw new ForbiddenException('Platform farm assignment requires tenantId');
      data.farmId = await this.assertFarmInTenant(input.farmId, tenantId);
    }
    return this.compact(data);
  }

  private async safeAdminUpdateData(dto: UpdateUserDto, existingTenantId?: string | null) {
    const input = dto as any;
    if (!this.requestContext.isPlatformAdmin() && input.role) {
      throw new ForbiddenException('Only platform administrators can assign user roles');
    }
    const tenantId = this.resolveTargetTenantId(input.tenantId ?? existingTenantId ?? undefined);
    const data: Record<string, unknown> = {
      phone: input.phone,
      email: input.email,
      name: input.name,
      remark: input.remark,
      status: input.status
    };
    if (this.requestContext.isPlatformAdmin()) {
      if (input.role) data.role = input.role;
      if (input.tenantId) data.tenantId = tenantId;
    }
    if (input.farmId) {
      if (this.requestContext.isPlatformAdmin() && !tenantId) throw new ForbiddenException('Platform farm assignment requires tenantId');
      data.farmId = await this.assertFarmInTenant(input.farmId, tenantId);
    }
    return this.compact(data);
  }

  private resolveTargetTenantId(inputTenantId?: string) {
    if (this.requestContext.isPlatformAdmin()) return inputTenantId ?? this.requestContext.getTenantId();
    return this.tenantScope.requireTenantId();
  }

  private async assertFarmInTenant(farmId: string, tenantId?: string | null) {
    const where = tenantId ? { id: farmId, tenantId } : { id: farmId };
    const farm = await this.prisma.farm.findFirst({ where, select: { id: true, tenantId: true } });
    if (!farm) throw new NotFoundException('Farm not found');
    if (tenantId && farm.tenantId !== tenantId) throw new ForbiddenException('Farm does not belong to tenant');
    return farm.id;
  }

  private compact(data: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
