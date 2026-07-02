import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { BillingService } from '../billing/billing.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { AiDecisionRequestDto } from './dto/ai-decision-request.dto';

@Injectable()
export class AiDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly eventBus: EventBusService,
    private readonly requestContext: RequestContextService
  ) {}

  async recommend(dto: AiDecisionRequestDto) {
    const field = await this.prisma.field.findUnique({ where: { id: dto.fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    const sensorData = await this.prisma.sensorRecord.findMany({
      where: { fieldId: dto.fieldId },
      orderBy: { reportedAt: 'desc' },
      take: 20
    });
    const latestMoisture = sensorData.find((item: any) => item.type === 'SOIL_MOISTURE')?.value;
    const waterState = this.classifyWaterState(Number(latestMoisture ?? 45));
    const strategy = this.generateStrategy(waterState, dto.cropType ?? '洋葱');
    const duration = waterState === 'dry' ? 30 : waterState === 'wet' ? 0 : 15;
    const decision = {
      fieldState: {
        fieldId: dto.fieldId,
        waterState,
        latestSoilMoisture: latestMoisture ?? null,
        cropType: dto.cropType ?? null
      },
      strategy,
      actions: [{ type: 'irrigation', duration, status: 'pending' }]
    };

    const tenantId = this.requestContext.getTenantId() ?? (field as any).tenantId;
    if (tenantId) {
      await this.billingService.recordUsage({ tenantId, type: 'AI_DECISION', quantity: 1, farmId: dto.farmId, fieldId: dto.fieldId, amount: 0 });
    }
    this.eventBus.publish('decision.generated', { farmId: dto.farmId, fieldId: dto.fieldId, strategy }, tenantId);
    return decision;
  }

  private classifyWaterState(soilMoisture: number) {
    if (soilMoisture < 25) return 'dry';
    if (soilMoisture > 60) return 'wet';
    return 'normal';
  }

  private generateStrategy(waterState: string, cropType: string) {
    if (waterState === 'dry') return `${cropType}抗旱保苗策略`;
    if (waterState === 'wet') return `${cropType}控水防病害策略`;
    return `${cropType}稳态生长策略`;
  }
}
