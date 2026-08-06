import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { roleIdentity } from '../../common/permissions/canonical-role';
import { ReauthenticateDto } from './dto/reauthenticate.dto';

type SafeUser = {
  id: string;
  tenantId: string | null;
  farmId: string | null;
  phone: string;
  email: string | null;
  name: string;
  role: string;
  status?: string;
  tokenVersion?: number;
  farm?: unknown;
};

const authFailureMessage = 'Account or password is incorrect';
const maxFailedLoginCount = 5;
const lockMinutes = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const isProduction = process.env.NODE_ENV === 'production';
    const publicRegistrationEnabled = process.env.ENABLE_PUBLIC_REGISTRATION === 'true';

    if (isProduction && !publicRegistrationEnabled) {
      throw new ForbiddenException('Public registration is disabled in production');
    }

    const allowedSelfServiceRoles = new Set<string>([
      'FARMER',
      'LARGE_GROWER',
      'DRONE_PILOT',
      'MACHINERY_PROVIDER',
      'INPUT_STORE'
    ]);

    if (!allowedSelfServiceRoles.has(dto.role)) {
      throw new ForbiddenException('Public registration cannot create administrative roles');
    }

    if (dto.tenantId || dto.farmId) {
      throw new ForbiddenException('Public registration cannot assign tenant or farm');
    }

    const identity = this.normalizeIdentity(dto.phone, dto.email);
    const exists = await this.findByIdentity(identity);
    if (exists) {
      throw new BadRequestException('Account already exists');
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
      throw new UnauthorizedException(authFailureMessage);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record({ eventType: 'auth.login.failed', severity: 'WARNING', userId: user.id, tenantId: user.tenantId, payload: { reason: 'locked' } });
      throw new UnauthorizedException(authFailureMessage);
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const failedLoginCount = (user.failedLoginCount ?? 0) + 1;
      const lockedUntil = failedLoginCount >= maxFailedLoginCount ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount, lockedUntil }
      });
      await this.audit.record({ eventType: 'auth.login.failed', severity: 'WARNING', userId: user.id, tenantId: user.tenantId, payload: { reason: 'bad_password' } });
      throw new UnauthorizedException(authFailureMessage);
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      include: { farm: true }
    });
    await this.audit.record({ eventType: 'auth.login', severity: 'INFO', userId: updated.id, tenantId: updated.tenantId, entityType: 'User', entityId: updated.id });
    return this.buildAuthResponse(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { farm: true } });
    if (!user || !user.passwordHash || user.status === 'DISABLED') {
      throw new UnauthorizedException('Authentication required');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      await this.audit.record({ eventType: 'auth.password_change.failed', severity: 'WARNING', userId: user.id, tenantId: user.tenantId, payload: { reason: 'bad_current_password' } });
      throw new UnauthorizedException(authFailureMessage);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null
      },
      include: { farm: true }
    });
    await this.audit.record({ eventType: 'auth.password_change', severity: 'INFO', userId: updated.id, tenantId: updated.tenantId, entityType: 'User', entityId: updated.id });
    return this.buildAuthResponse(updated);
  }

  async refresh(refreshToken: string) {
    let payload: { userId?: string; tokenVersion?: number; tokenType?: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!payload.userId || payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.userId }, include: { farm: true } });
    if (!user || user.status === 'DISABLED' || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotated = await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
      include: { farm: true }
    });
    await this.audit.record({ eventType: 'auth.refresh', severity: 'INFO', userId: rotated.id, tenantId: rotated.tenantId, entityType: 'User', entityId: rotated.id });
    return this.buildAuthResponse(rotated);
  }

  async logout(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true } });
    if (user) {
      await this.audit.record({ eventType: 'auth.logout', severity: 'INFO', userId: user.id, tenantId: user.tenantId, entityType: 'User', entityId: user.id });
    }
    return { ok: true };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { farm: true } });
    if (!user || user.status === 'DISABLED') {
      throw new UnauthorizedException('User is not available');
    }
    return {
      user: this.safeUser(user),
      tenant: user.tenantId ? await (this.prisma as any).tenant.findUnique({ where: { id: user.tenantId } }) : null,
      role: user.role
      ,...roleIdentity(user.role)
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
      throw new BadRequestException('Phone or email is required');
    }
    return { phone: normalizedPhone, email: normalizedEmail };
  }

  private buildAuthResponse(user: SafeUser & { passwordHash?: string | null }) {
    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      farmId: user.farmId ?? undefined,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0
    };
    const accessToken = this.jwtService.sign({ ...tokenPayload, tokenType: 'access' });
    const refreshToken = this.jwtService.sign(
      { ...tokenPayload, tokenType: 'refresh' },
      { secret: this.refreshSecret(), expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as any }
    );
    return {
      accessToken,
      refreshToken,
      user: this.safeUser(user)
      ,...roleIdentity(user.role)
    };
  }

  async reauthenticate(userId: string, dto: ReauthenticateDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DISABLED' || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.record({ eventType: 'auth.reauthenticate.failed', severity: 'WARNING', userId, tenantId: user?.tenantId });
      throw new UnauthorizedException('Re-authentication failed');
    }
    const reauthToken = this.jwtService.sign({ userId: user.id, tenantId: user.tenantId ?? undefined, tokenVersion: user.tokenVersion, tokenType: 'reauth' }, { expiresIn: '5m' });
    await this.audit.record({ eventType: 'auth.reauthenticate', severity: 'INFO', userId, tenantId: user.tenantId });
    return { reauthToken, expiresInSeconds: 300 };
  }

  private refreshSecret() {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is required');
    return secret;
  }

  private safeUser(user: SafeUser & { passwordHash?: string | null }) {
    const { passwordHash: _passwordHash, tokenVersion: _tokenVersion, ...safeUser } = user;
    return { ...safeUser, ...roleIdentity(user.role) };
  }
}
