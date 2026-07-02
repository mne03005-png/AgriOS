import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BluetoothService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async createSession(dto: any) {
    const session = await (this.prisma as any).bluetoothSession.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        userId: this.requestContext.getUserId() ?? dto.userId,
        sessionCode: dto.sessionCode ?? randomUUID(),
        status: 'ACTIVE',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 30 * 60 * 1000),
        ...dto
      }
    });
    await this.audit.record({ eventType: 'bluetooth.session.create', entityType: 'BluetoothSession', entityId: session.id });
    return session;
  }

  listSessions(query: Record<string, unknown>) {
    return (this.prisma as any).bluetoothSession.findMany({
      where: {
        ...(this.requestContext.getTenantId() && !this.requestContext.isPlatformAdmin() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findSession(id: string) {
    const session = await (this.prisma as any).bluetoothSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Bluetooth session not found');
    return session;
  }

  complete(id: string) {
    return this.changeStatus(id, 'COMPLETED', 'bluetooth.session.complete');
  }

  revoke(id: string) {
    return this.changeStatus(id, 'REVOKED', 'bluetooth.session.revoke');
  }

  async addOperationLog(id: string, dto: any) {
    await this.findSession(id);
    const log = await (this.prisma as any).bluetoothOperationLog.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        userId: this.requestContext.getUserId() ?? dto.userId,
        sessionId: id,
        ...dto
      }
    });
    await this.audit.record({ eventType: 'bluetooth.operation.log', entityType: 'BluetoothOperationLog', entityId: log.id, payload: { operationType: log.operationType } });
    return log;
  }

  listOperationLogs(id: string) {
    return (this.prisma as any).bluetoothOperationLog.findMany({ where: { sessionId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  private async changeStatus(id: string, status: string, eventType: string) {
    const session = await (this.prisma as any).bluetoothSession.update({ where: { id }, data: { status } });
    await this.audit.record({ eventType, entityType: 'BluetoothSession', entityId: id });
    return session;
  }
}
