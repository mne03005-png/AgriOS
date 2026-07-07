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
    const data = this.safeWriteData(dto);
    return this.prisma.user.create({ data: this.tenantScope.createData(data) as any, select: safeUserSelect });
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
    if (id !== currentUserId) this.assertCanManageUsers();
    const existing = await this.prisma.user.findFirst({ where: this.tenantScope.where({ id }), select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: this.safeWriteData(dto), select: safeUserSelect });
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

  private safeWriteData(dto: CreateUserDto | UpdateUserDto) {
    const input = dto as any;
    const data: Record<string, unknown> = {
      phone: input.phone,
      email: input.email,
      name: input.name,
      farmId: input.farmId,
      remark: input.remark
    };
    if (this.requestContext.isPlatformAdmin()) {
      data.role = input.role;
    } else if (input.role && input.role !== 'PLATFORM_ADMIN') {
      data.role = input.role;
    }
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }
}
