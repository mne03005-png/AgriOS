import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type DecisionFieldState = {
  farmId: string;
  fieldId: string;
  fieldName: string;
  cropSeasonId: string | null;
  cropName: string | null;
  soilMoisture: number | null;
  temperature: number | null;
  humidity: number | null;
  latestSensorRecordId: string | null;
  latestSensorReportedAt: Date | null;
  deviceTotal: number;
  deviceOnlineCount: number;
  deviceOfflineCount: number;
  riskLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
};

@Injectable()
export class StateService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: { farmId: string; fieldId: string }): Promise<DecisionFieldState> {
    const field = await this.prisma.field.findFirst({
      where: { id: input.fieldId, farmId: input.farmId },
      include: { devices: true }
    });
    if (!field) throw new NotFoundException('Field not found in farm');

    const [cropSeason, latestSensorRecord] = await Promise.all([
      this.prisma.cropSeason.findFirst({
        where: { fieldId: input.fieldId, status: { in: ['PLANNED', 'GROWING'] } },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
      }),
      (this.prisma as any).sensorRecord.findFirst({
        where: { fieldId: input.fieldId },
        orderBy: { reportedAt: 'desc' }
      })
    ]);

    const soilMoisture = this.numberOrNull(latestSensorRecord?.soilMoisture ?? latestSensorRecord?.value);
    const temperature = this.numberOrNull(latestSensorRecord?.temperature);
    const humidity = this.numberOrNull(latestSensorRecord?.humidity);
    const deviceOnlineCount = field.devices.filter((device) => device.online || device.iotStatus === 'ONLINE').length;
    const deviceOfflineCount = field.devices.length - deviceOnlineCount;

    return {
      farmId: input.farmId,
      fieldId: field.id,
      fieldName: field.name,
      cropSeasonId: cropSeason?.id ?? null,
      cropName: cropSeason?.cropName ?? null,
      soilMoisture,
      temperature,
      humidity,
      latestSensorRecordId: latestSensorRecord?.id ?? null,
      latestSensorReportedAt: latestSensorRecord?.reportedAt ?? null,
      deviceTotal: field.devices.length,
      deviceOnlineCount,
      deviceOfflineCount,
      riskLevel: this.riskLevel(soilMoisture, deviceOfflineCount, field.devices.length)
    };
  }

  private numberOrNull(value: unknown) {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private riskLevel(soilMoisture: number | null, offlineCount: number, totalDevices: number): DecisionFieldState['riskLevel'] {
    if (soilMoisture !== null && (soilMoisture < 25 || soilMoisture > 75)) return 'CRITICAL';
    if (soilMoisture !== null && (soilMoisture < 35 || soilMoisture > 60)) return 'HIGH';
    if (totalDevices > 0 && offlineCount === totalDevices) return 'HIGH';
    if (offlineCount > 0) return 'LOW';
    return 'NORMAL';
  }
}
