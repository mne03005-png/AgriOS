import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReauthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.first(request.headers?.['x-reauth-token']);
    if (!token) throw new UnauthorizedException('Recent re-authentication is required');
    let payload: any;
    try { payload = this.jwt.verify(token); } catch { throw new UnauthorizedException('Re-authentication token is invalid or expired'); }
    if (payload?.tokenType !== 'reauth' || payload?.userId !== request.user?.userId || payload?.tokenVersion !== request.user?.tokenVersion) {
      throw new UnauthorizedException('Re-authentication token does not match this session');
    }
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
    if (!reason) throw new ForbiddenException('A reason is required for dangerous operations');
    await (this.prisma as any).auditEvent.create({ data: {
      tenantId: request.user?.tenantId, userId: request.user?.userId, eventType: 'dangerous_operation.requested', severity: 'WARNING',
      requestId: request.requestId, ip: request.ip, userAgent: request.headers?.['user-agent'],
      payload: { path: request.url, method: request.method, reason, deviceId: request.params?.deviceId ?? request.params?.id, farmId: request.body?.farmId, zoneId: request.body?.zoneId }
    }});
    return true;
  }

  private first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
}
