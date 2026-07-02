import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { ActionQueueService } from '../action-queue/action-queue.service';
import { BillingService } from '../billing/billing.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';
import { CreateDissolveFertilizerTaskDto } from './dto/create-dissolve-fertilizer-task.dto';
import { CreateFertigationRecipeDto } from './dto/create-fertigation-recipe.dto';
import { CreateFertigationTaskDto } from './dto/create-fertigation-task.dto';
import { CreateFertilizerTankDto } from './dto/create-fertilizer-tank.dto';
import { StartFertigationTaskDto } from './dto/start-fertigation-task.dto';
import { UpdateFertilizerTankDto } from './dto/update-fertilizer-tank.dto';

@Injectable()
export class FertigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly actionQueueService: ActionQueueService,
    private readonly billingService: BillingService,
    private readonly eventBus: EventBusService,
    private readonly farmActivityService: FarmActivityService
  ) {}

  createTank(dto: CreateFertilizerTankDto) {
    return (this.prisma as any).fertilizerTank.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        ...dto,
        status: this.tankStatus(dto.currentLevelL, dto.capacityL)
      }
    });
  }

  listTanks(query: Record<string, unknown>) {
    return (this.prisma as any).fertilizerTank.findMany({
      where: { ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}) },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateTank(id: string, dto: UpdateFertilizerTankDto) {
    const tank = await this.ensureTank(id);
    return (this.prisma as any).fertilizerTank.update({
      where: { id },
      data: { ...dto, status: this.tankStatus(dto.currentLevelL ?? Number(tank.currentLevelL ?? 0), dto.capacityL ?? Number(tank.capacityL ?? 0)) }
    });
  }

  createRecipe(dto: CreateFertigationRecipeDto) {
    return (this.prisma as any).fertigationRecipe.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId: dto.farmId,
        cropType: dto.cropType,
        cropStage: dto.cropStage,
        name: dto.name,
        recipeJson: dto.recipeJson,
        recommendedDurationMinutes: dto.recommendedDurationMinutes,
        isActive: dto.isActive ?? true
      }
    });
  }

  listRecipes(query: Record<string, unknown>) {
    return (this.prisma as any).fertigationRecipe.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { OR: [{ farmId: query.farmId }, { farmId: null }] } : {}),
        ...(typeof query.cropType === 'string' ? { cropType: query.cropType } : {}),
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTask(dto: CreateFertigationTaskDto) {
    const tank = dto.tankId ? await this.ensureTank(dto.tankId) : null;
    const blocked = tank && dto.targetFertilizerVolume !== undefined && Number(tank.currentLevelL ?? 0) < dto.targetFertilizerVolume;
    return (this.prisma as any).fertigationTask.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        ...dto,
        status: blocked ? 'BLOCKED' : 'DRAFT',
        resultJson: blocked ? { reason: 'Fertilizer tank level is insufficient' } : undefined
      }
    });
  }

  listTasks(query: Record<string, unknown>) {
    return (this.prisma as any).fertigationTask.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      include: { tank: true, recipe: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async startTask(id: string, dto: StartFertigationTaskDto) {
    const task = await (this.prisma as any).fertigationTask.findUnique({ where: { id }, include: { tank: true, recipe: true } });
    if (!task) throw new NotFoundException('Fertigation task not found');
    if (task.status === 'BLOCKED') throw new BadRequestException('Fertigation task is blocked');
    if (task.tank && task.targetFertilizerVolume && Number(task.tank.currentLevelL ?? 0) < Number(task.targetFertilizerVolume)) {
      return (this.prisma as any).fertigationTask.update({
        where: { id },
        data: { status: 'BLOCKED', resultJson: { reason: 'Fertilizer tank level is insufficient' } }
      });
    }
    if (!task.fieldId) throw new BadRequestException('Fertigation task requires fieldId to generate action plan');

    const deviceId = task.tank?.deviceId;
    if (!deviceId) throw new BadRequestException('Fertigation tank requires deviceId before start');

    const decision = await (this.prisma as any).decisionRecord.create({
      data: {
        tenantId: task.tenantId,
        fieldId: task.fieldId,
        decisionType: 'IRRIGATION',
        recommendation: 'SHOULD_IRRIGATE',
        confidence: 0.75,
        reason: `Start fertigation task: ${task.id}`,
        status: 'PLANNED',
        metadata: { source: 'FERTIGATION', taskId: id, recipeId: task.recipeId, remark: dto.remark }
      }
    });
    const actionPlan = await (this.prisma as any).actionPlan.create({
      data: {
        tenantId: task.tenantId,
        decisionId: decision.id,
        fieldId: task.fieldId,
        status: 'PLANNED',
        actions: [
          {
            type: 'DEVICE_COMMAND',
            command: 'START_FERTIGATION',
            deviceId,
            payload: {
              durationMinutes: task.durationMinutes ?? task.recipe?.recommendedDurationMinutes ?? 30,
              targetWaterVolume: Number(task.targetWaterVolume ?? 0),
              targetFertilizerVolume: Number(task.targetFertilizerVolume ?? 0),
              taskId: id
            }
          }
        ],
        safety: { source: 'FERTIGATION', requiresQueue: true }
      }
    });
    const queueJob = await this.actionQueueService.enqueue({ farmId: task.farmId, actionPlanId: actionPlan.id });
    const updated = await (this.prisma as any).fertigationTask.update({
      where: { id },
      data: { status: 'QUEUED', startedAt: new Date(), actionPlanId: actionPlan.id, resultJson: { queueJobId: queueJob.id } }
    });
    await this.recordUsage(task, id);
    this.eventBus.publish('fertigation.task.started', { farmId: task.farmId, fieldId: task.fieldId, taskId: id, actionPlanId: actionPlan.id }, task.tenantId);
    await this.farmActivityService.create({
      tenantId: task.tenantId,
      farmId: task.farmId,
      fieldId: task.fieldId,
      type: 'FERTIGATION_STARTED',
      title: '水肥任务已排队',
      refType: 'FertigationTask',
      refId: id,
      metadata: { actionPlanId: actionPlan.id, queueJobId: queueJob.id }
    });
    return { task: updated, actionPlan, queueJob };
  }

  async cancelTask(id: string) {
    const task = await (this.prisma as any).fertigationTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Fertigation task not found');
    const updated = await (this.prisma as any).fertigationTask.update({ where: { id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
    this.eventBus.publish('fertigation.task.cancelled', { farmId: task.farmId, fieldId: task.fieldId, taskId: id }, task.tenantId);
    return updated;
  }

  async createDissolveTask(dto: CreateDissolveFertilizerTaskDto) {
    const tank = await this.ensureTank(dto.tankId);
    return (this.prisma as any).dissolveFertilizerTask.create({
      data: {
        tenantId: tank.tenantId ?? this.requestContext.getTenantId(),
        farmId: dto.farmId,
        tankId: dto.tankId,
        waterVolumeL: dto.waterVolumeL,
        fertilizerWeightKg: dto.fertilizerWeightKg,
        durationMinutes: dto.durationMinutes,
        status: 'PENDING'
      }
    });
  }

  private async ensureTank(id: string) {
    const tank = await (this.prisma as any).fertilizerTank.findUnique({ where: { id } });
    if (!tank) throw new NotFoundException('Fertilizer tank not found');
    return tank;
  }

  private tankStatus(current?: number, capacity?: number) {
    if (current === undefined || current === null) return 'ACTIVE';
    if (current <= 0) return 'EMPTY';
    if (capacity && current / capacity < 0.15) return 'LOW_LEVEL';
    return 'ACTIVE';
  }

  private async recordUsage(task: any, taskId: string) {
    const tenantId = task.tenantId ?? this.requestContext.getTenantId();
    if (!tenantId) return;
    await this.billingService.recordUsage({
      tenantId,
      farmId: task.farmId,
      fieldId: task.fieldId,
      type: 'IRRIGATION_ACTION',
      quantity: 1,
      unit: 'fertigation-task',
      amount: 0,
      refType: 'FertigationTask',
      refId: taskId
    });
  }
}
