import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { PreviewFieldDto } from './dto/preview-field.dto';

@Injectable()
export class DigitalTwinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService
  ) {}

  async previewField(fieldId: string, dto: PreviewFieldDto) {
    const field = await this.prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    const latestMoisture = await this.prisma.sensorRecord.findFirst({
      where: { fieldId, type: 'SOIL_MOISTURE' },
      orderBy: { reportedAt: 'desc' }
    });
    const currentSoilMoisture = Number(latestMoisture?.value ?? 45);
    const predictedSoilMoisture = Math.min(75, currentSoilMoisture + Number(dto.irrigationMinutes ?? 0) * 0.35);
    const simulation = {
      currentSoilMoisture,
      predictedSoilMoisture,
      waterAmount: dto.waterAmount ?? 0,
      recommendation: predictedSoilMoisture > 65 ? '注意控水，避免病害风险' : '模拟结果处于安全范围'
    };
    const snapshot = await (this.prisma as any).digitalTwinSnapshot.create({
      data: {
        tenantId: this.requestContext.getTenantId() ?? (field as any).tenantId,
        fieldId,
        soilState: { currentSoilMoisture, predictedSoilMoisture },
        cropState: {},
        prediction: simulation
      }
    });
    this.eventBus.publish('digital_twin.preview.created', { fieldId, snapshotId: snapshot.id }, snapshot.tenantId);
    return { field, simulation, snapshot };
  }
}
