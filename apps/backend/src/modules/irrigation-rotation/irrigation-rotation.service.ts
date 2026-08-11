import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { ActionQueueService } from '../action-queue/action-queue.service';
import { BillingService } from '../billing/billing.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';
import { CreateRotationGroupDto } from './dto/create-rotation-group.dto';
import { CreateRotationScheduleDto } from './dto/create-rotation-schedule.dto';
import { CreateRotationValveDto } from './dto/create-rotation-valve.dto';
import { StartRotationDto } from './dto/start-rotation.dto';
import { UpdateRotationGroupDto } from './dto/update-rotation-group.dto';

@Injectable()
export class IrrigationRotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly actionQueueService: ActionQueueService,
    private readonly billingService: BillingService,
    private readonly eventBus: EventBusService,
    private readonly farmActivityService: FarmActivityService
  ) {}

  createGroup(dto: CreateRotationGroupDto) {
    return (this.prisma as any).irrigationRotationGroup.create({
      data: {
        ...dto,
        tenantId: this.requestContext.getTenantId()
      }
    });
  }

  listGroups(query: Record<string, unknown>) {
    return (this.prisma as any).irrigationRotationGroup.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      include: { valves: true, schedules: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getGroup(id: string) {
    const group = await (this.prisma as any).irrigationRotationGroup.findUnique({ where: { id }, include: { valves: true, schedules: true, runs: true } });
    if (!group) throw new NotFoundException('Irrigation rotation group not found');
    return group;
  }

  async updateGroup(id: string, dto: UpdateRotationGroupDto) {
    await this.ensureGroup(id);
    return (this.prisma as any).irrigationRotationGroup.update({ where: { id }, data: dto });
  }

  async addValve(groupId: string, dto: CreateRotationValveDto) {
    await this.ensureGroup(groupId);
    return (this.prisma as any).irrigationRotationValve.create({ data: { groupId, ...dto } });
  }

  async addSchedule(groupId: string, dto: CreateRotationScheduleDto) {
    const group = await this.ensureGroup(groupId);
    return (this.prisma as any).irrigationRotationSchedule.create({
      data: {
        tenantId: group.tenantId,
        farmId: group.farmId,
        groupId,
        name: dto.name,
        scheduleJson: dto.scheduleJson,
        isActive: dto.isActive ?? true
      }
    });
  }

  async start(groupId: string, dto: StartRotationDto) {
    const group = await this.getGroup(groupId);
    if (group.status !== 'ACTIVE') throw new BadRequestException('Only ACTIVE rotation groups can be started');
    if (!group.valves?.length) throw new BadRequestException('Rotation group has no valves');

    const fieldId = group.fieldId ?? group.valves.find((valve: any) => valve.fieldId)?.fieldId;
    if (!fieldId) throw new BadRequestException('Rotation group requires a fieldId on group or valve');

    const decision = await (this.prisma as any).decisionRecord.create({
      data: {
        tenantId: group.tenantId,
        fieldId,
        decisionType: 'IRRIGATION',
        recommendation: 'SHOULD_IRRIGATE',
        confidence: 0.8,
        reason: `Start irrigation rotation group: ${group.name}`,
        status: 'PLANNED',
        metadata: { source: 'IRRIGATION_ROTATION', groupId, scheduleId: dto.scheduleId, remark: dto.remark }
      }
    });

    const actions = group.valves
      .slice()
      .sort((a: any, b: any) => a.valveOrder - b.valveOrder)
      .map((valve: any) => ({
        type: 'DEVICE_COMMAND',
        command: 'VALVE_OPEN',
        deviceId: valve.deviceId,
        payload: {
          openingPercent: Number(valve.targetOpeningPercent ?? 100),
          durationMinutes: valve.maxIrrigationMinutes ?? 30,
          rotationGroupId: groupId,
          zoneId: valve.zoneId
        }
      }));

    const actionPlan = await (this.prisma as any).actionPlan.create({
      data: {
        tenantId: group.tenantId,
        decisionId: decision.id,
        fieldId,
        status: 'PLANNED',
        actions,
        safety: { source: 'IRRIGATION_ROTATION', requiresQueue: true, note: 'P11.2 does not bypass safety/action queue.' }
      }
    });

    const run = await (this.prisma as any).irrigationRotationRun.create({
      data: {
        tenantId: group.tenantId,
        farmId: group.farmId,
        groupId,
        scheduleId: dto.scheduleId,
        status: 'RUNNING',
        actionPlanId: actionPlan.id,
        startedAt: new Date(),
        resultJson: { actionPlanId: actionPlan.id, valveCount: actions.length }
      }
    });

    const queueJob = await this.actionQueueService.enqueue({ farmId: group.farmId, actionPlanId: actionPlan.id });
    // Final usage is recorded idempotently by ExecutionResultLinker after physical confirmation.
    this.eventBus.publish('irrigation.rotation.started', { farmId: group.farmId, fieldId, groupId, runId: run.id, actionPlanId: actionPlan.id }, group.tenantId);
    await this.farmActivityService.create({
      tenantId: group.tenantId,
      farmId: group.farmId,
      fieldId,
      type: 'ROTATION_STARTED',
      title: `轮灌启动：${group.name}`,
      refType: 'IrrigationRotationRun',
      refId: run.id,
      metadata: { actionPlanId: actionPlan.id, queueJobId: queueJob.id }
    });

    return { run, actionPlan, queueJob };
  }

  async stopRun(id: string) {
    const run = await (this.prisma as any).irrigationRotationRun.findUnique({ where: { id }, include: { group: true } });
    if (!run) throw new NotFoundException('Irrigation rotation run not found');
    const updated = await (this.prisma as any).irrigationRotationRun.update({
      where: { id },
      data: { status: 'CANCELLED', finishedAt: new Date(), resultJson: { ...(run.resultJson ?? {}), stoppedManually: true } }
    });
    this.eventBus.publish('irrigation.rotation.stopped', { farmId: run.farmId, groupId: run.groupId, runId: id }, run.tenantId);
    await this.farmActivityService.create({
      tenantId: run.tenantId,
      farmId: run.farmId,
      fieldId: run.group?.fieldId,
      type: 'ROTATION_COMPLETED',
      title: `轮灌停止：${run.group?.name ?? id}`,
      refType: 'IrrigationRotationRun',
      refId: id,
      metadata: { status: 'CANCELLED' }
    });
    return updated;
  }

  private async ensureGroup(id: string) {
    const group = await (this.prisma as any).irrigationRotationGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Irrigation rotation group not found');
    return group;
  }

  private async recordUsage(group: any, fieldId: string, runId: string, valveCount: number) {
    const tenantId = group.tenantId ?? this.requestContext.getTenantId();
    if (!tenantId) return;
    await this.billingService.recordUsage({
      tenantId,
      farmId: group.farmId,
      fieldId,
      type: 'IRRIGATION_ACTION',
      quantity: valveCount,
      unit: 'valve-action',
      amount: 0,
      refType: 'IrrigationRotationRun',
      refId: runId
    });
  }
}
