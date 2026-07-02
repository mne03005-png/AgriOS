import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { hasPermissions } from './permission-matrix';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionKey } from './permission.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.role) {
      await this.recordDenied(request, required, 'missing_user');
      throw new UnauthorizedException('Authentication required for this operation');
    }

    if (!hasPermissions(user.role, required)) {
      await this.recordDenied(request, required, 'role_denied');
      throw new ForbiddenException('当前角色无权限执行该操作，请联系农场管理员');
    }

    return true;
  }

  private recordDenied(request: any, required: PermissionKey[], reason: string) {
    return (this.prisma as any).auditEvent.create({
      data: {
        tenantId: request.user?.tenantId,
        userId: request.user?.userId,
        eventType: 'permission_denied',
        severity: 'WARNING',
        requestId: request.requestId,
        payload: { required, reason, role: request.user?.role, path: request.url }
      }
    });
  }
}
