import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InstallerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async create(dto: any) {
    const item = await (this.prisma as any).deviceInstallationCheck.create({
      data: { tenantId: this.requestContext.getTenantId(), ...dto }
    });
    await this.audit.record({ eventType: 'installer.check.create', entityType: 'DeviceInstallationCheck', entityId: item.id, payload: { deviceCode: item.deviceCode } });
    return item;
  }

  list(query: Record<string, unknown>) {
    return (this.prisma as any).deviceInstallationCheck.findMany({
      where: {
        ...(this.requestContext.getTenantId() && !this.requestContext.isPlatformAdmin() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findOne(id: string) {
    const item = await (this.prisma as any).deviceInstallationCheck.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Device installation check not found');
    return item;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return (this.prisma as any).deviceInstallationCheck.update({ where: { id }, data: dto });
  }

  markPassed(id: string) {
    return this.mark(id, 'PASSED', 'installer.check.passed');
  }

  markFailed(id: string, body: { notes?: string }) {
    return this.mark(id, 'FAILED', 'installer.check.failed', body.notes);
  }

  async linkAgriosDevice(id: string, body: { deviceId: string }) {
    const item = await this.update(id, { deviceId: body.deviceId, bindingOk: true });
    await this.audit.record({ eventType: 'installer.check.link_device', entityType: 'DeviceInstallationCheck', entityId: id, payload: { deviceId: body.deviceId } });
    return item;
  }

  private async mark(id: string, status: string, eventType: string, notes?: string) {
    const item = await this.update(id, { status, notes, checkedAt: new Date() });
    await this.audit.record({ eventType, severity: status === 'FAILED' ? 'WARNING' : 'INFO', entityType: 'DeviceInstallationCheck', entityId: id });
    return item;
  }
}
