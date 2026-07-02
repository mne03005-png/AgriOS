import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EdgeGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService
  ) {}

  createGateway(dto: any) {
    return (this.prisma as any).edgeGateway.create({ data: { tenantId: this.requestContext.getTenantId(), ...dto } });
  }

  listGateways(query: Record<string, unknown>) {
    return (this.prisma as any).edgeGateway.findMany({
      where: {
        ...(this.requestContext.getTenantId() && !this.requestContext.isPlatformAdmin() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findGateway(id: string) {
    const gateway = await (this.prisma as any).edgeGateway.findUnique({ where: { id } });
    if (!gateway) throw new NotFoundException('Edge gateway not found');
    return gateway;
  }

  bindDevice(dto: any) {
    return (this.prisma as any).edgeDeviceBinding.upsert({
      where: { gatewayId_deviceId: { gatewayId: dto.gatewayId, deviceId: dto.deviceId } },
      update: { ...dto, tenantId: this.requestContext.getTenantId() },
      create: { ...dto, tenantId: this.requestContext.getTenantId() }
    });
  }

  listBindings(query: Record<string, unknown>) {
    return (this.prisma as any).edgeDeviceBinding.findMany({
      where: {
        ...(this.requestContext.getTenantId() && !this.requestContext.isPlatformAdmin() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.gatewayId === 'string' ? { gatewayId: query.gatewayId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async createCommand(dto: any) {
    const command = await (this.prisma as any).edgeCommand.create({
      data: { tenantId: this.requestContext.getTenantId(), requestId: randomUUID(), status: 'PENDING', ...dto }
    });
    await this.audit.record({ eventType: 'edge.command.create', entityType: 'EdgeCommand', entityId: command.id, payload: { command: command.command } });
    return command;
  }

  listCommands(query: Record<string, unknown>) {
    return (this.prisma as any).edgeCommand.findMany({
      where: {
        ...(this.requestContext.getTenantId() && !this.requestContext.isPlatformAdmin() ? { tenantId: this.requestContext.getTenantId() } : {}),
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.gatewayId === 'string' ? { gatewayId: query.gatewayId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async ackCommand(id: string, body: { resultJson?: unknown }) {
    const command = await (this.prisma as any).edgeCommand.update({ where: { id }, data: { status: 'ACKED', ackAt: new Date(), resultJson: body.resultJson as any } });
    await this.audit.record({ eventType: 'edge.command.ack', entityType: 'EdgeCommand', entityId: id });
    return command;
  }

  async failCommand(id: string, body: { errorMessage?: string }) {
    const command = await (this.prisma as any).edgeCommand.update({ where: { id }, data: { status: 'FAILED', errorMessage: body.errorMessage ?? 'failed by operator' } });
    await this.audit.record({ eventType: 'edge.command.fail', severity: 'WARNING', entityType: 'EdgeCommand', entityId: id });
    return command;
  }
}
