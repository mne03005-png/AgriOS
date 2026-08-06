import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CanonicalRole, canonicalRoleFor, effectivePermissionsFor } from '../../common/permissions/canonical-role';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    userId: string;
    tenantId?: string;
    farmId?: string;
    role: string;
    canonicalRole?: CanonicalRole;
    effectivePermissions?: string[];
    tokenVersion?: number;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const token = headerValue?.startsWith('Bearer ') ? headerValue.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = this.jwtService.verify(token) as AuthenticatedRequest['user'];
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
      canonicalRole: canonicalRoleFor(user.role),
      effectivePermissions: effectivePermissionsFor(user.role),
      tokenVersion: user.tokenVersion
    };
    return true;
  }
}
