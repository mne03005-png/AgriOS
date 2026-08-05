import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RequestContextService } from '../../common/request-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    userId: string;
    tenantId?: string;
    farmId?: string;
    role: string;
    tokenVersion?: number;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const token = headerValue?.startsWith('Bearer ') ? headerValue.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: AuthenticatedRequest['user'];
    try {
      payload = this.jwtService.verify(token) as AuthenticatedRequest['user'];
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    if (!payload?.userId) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, tenantId: true, farmId: true, role: true, status: true, tokenVersion: true }
    });
    if (!user || user.status === 'DISABLED' || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    request.user = {
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      farmId: user.farmId ?? undefined,
      role: user.role,
      tokenVersion: user.tokenVersion
    };
    this.requestContext.setAuthContext({
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      farmId: user.farmId ?? undefined,
      role: user.role
    });
    return true;
  }
}
