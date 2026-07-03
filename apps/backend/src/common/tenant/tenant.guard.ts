import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userTenantId = request.user?.tenantId;
    const role = request.user?.role;
    const requestedTenantId = this.first(request.query?.tenantId ?? request.headers?.['x-tenant-id']);
    const farmId = this.first(request.query?.farmId ?? request.body?.farmId ?? request.params?.farmId);

    if (!request.user) {
      if (!requestedTenantId && (!farmId || farmId === 'demo')) return true;
      throw new ForbiddenException('Unauthenticated access is limited to demo farm data');
    }

    if (this.isPlatformRole(role)) {
      if (requestedTenantId && requestedTenantId !== userTenantId) {
        await this.audit(request, 'cross_tenant_access', { requestedTenantId, userTenantId });
      }
      return true;
    }

    if (requestedTenantId && userTenantId && requestedTenantId !== userTenantId) {
      await this.audit(request, 'cross_tenant_denied', { requestedTenantId, userTenantId });
      throw new ForbiddenException('Tenant mismatch');
    }

    if (farmId && userTenantId) {
      const farm = await this.prisma.farm.findFirst({ where: { id: farmId, tenantId: userTenantId }, select: { id: true } });
      if (!farm) {
        await this.audit(request, 'cross_farm_denied', { farmId, userTenantId });
        throw new ForbiddenException('Farm mismatch');
      }
    }

    return true;
  }

  private isPlatformRole(role?: string) {
    return role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN';
  }

  private first(value: unknown) {
    return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : undefined;
  }

  private audit(request: any, eventType: string, payload: Record<string, unknown>) {
    return (this.prisma as any).auditEvent.create({
      data: {
        tenantId: request.user?.tenantId,
        userId: request.user?.userId,
        eventType,
        severity: eventType.endsWith('denied') ? 'WARNING' : 'INFO',
        requestId: request.requestId,
        payload
      }
    });
  }
}
