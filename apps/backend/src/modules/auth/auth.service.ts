import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type SafeUser = {
  id: string;
  tenantId: string | null;
  farmId: string | null;
  phone: string;
  email: string | null;
  name: string;
  role: string;
  status?: string;
  farm?: unknown;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async register(dto: RegisterDto) {
    const isProduction = process.env.NODE_ENV === 'production';
    const publicRegistrationEnabled = process.env.ENABLE_PUBLIC_REGISTRATION === 'true';

    if (isProduction && !publicRegistrationEnabled) {
      throw new ForbiddenException('生产环境已关闭公开注册');
    }

    const allowedSelfServiceRoles = new Set<string>([
      'FARMER',
      'LARGE_GROWER',
      'DRONE_PILOT',
      'MACHINERY_PROVIDER',
      'INPUT_STORE'
    ]);

    if (!allowedSelfServiceRoles.has(dto.role)) {
      throw new ForbiddenException('公开注册不允许创建管理角色');
    }

    if (dto.tenantId || dto.farmId) {
      throw new ForbiddenException('公开注册不允许指定租户或农场');
    }

    const identity = this.normalizeIdentity(dto.phone, dto.email);
    const exists = await this.findByIdentity(identity);
    if (exists) {
      throw new BadRequestException('账号已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: identity.phone,
        email: identity.email,
        tenantId: dto.tenantId,
        role: dto.role,
        farmId: dto.farmId,
        passwordHash,
        status: 'ACTIVE'
      },
      include: { farm: true }
    });
    await this.audit.record({ eventType: 'auth.register', severity: 'INFO', userId: user.id, tenantId: user.tenantId, entityType: 'User', entityId: user.id });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const identity = this.normalizeIdentity(dto.phone, dto.email);
    const user = await this.findByIdentity(identity);
    if (!user || !user.passwordHash || user.status === 'DISABLED') {
      await this.audit.record({ eventType: 'auth.login.failed', severity: 'WARNING', payload: { phone: identity.phone, email: identity.email } });
      throw new UnauthorizedException('账号或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.audit.record({ eventType: 'auth.login.failed', severity: 'WARNING', userId: user.id, tenantId: user.tenantId, payload: { reason: 'bad_password' } });
      throw new UnauthorizedException('账号或密码错误');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { farm: true }
    });
    await this.audit.record({ eventType: 'auth.login', severity: 'INFO', userId: updated.id, tenantId: updated.tenantId, entityType: 'User', entityId: updated.id });
    return this.buildAuthResponse(updated);
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { farm: true } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return {
      user: this.safeUser(user),
      tenant: user.tenantId ? await (this.prisma as any).tenant.findUnique({ where: { id: user.tenantId } }) : null,
      role: user.role
    };
  }

  private async findByIdentity(identity: { phone: string; email?: string }) {
    if (identity.email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email }, include: { farm: true } });
      if (byEmail) return byEmail;
    }
    return this.prisma.user.findUnique({ where: { phone: identity.phone }, include: { farm: true } });
  }

  private normalizeIdentity(phone?: string, email?: string) {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.trim() || normalizedEmail;
    if (!normalizedPhone) {
      throw new BadRequestException('手机号或邮箱至少填写一个');
    }
    return { phone: normalizedPhone, email: normalizedEmail };
  }

  private buildAuthResponse(user: SafeUser & { passwordHash?: string | null }) {
    const accessToken = this.jwtService.sign({
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      farmId: user.farmId ?? undefined,
      role: user.role
    });
    return {
      accessToken,
      user: this.safeUser(user)
    };
  }

  private safeUser(user: SafeUser & { passwordHash?: string | null }) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
