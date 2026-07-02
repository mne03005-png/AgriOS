import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FieldStateEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async build(fieldId: string) {
    const field = await this.prisma.field.findUnique({ where: { id: fieldId }, include: { devices: true } });
    if (!field) throw new NotFoundException('Field not found');

    const [cropSeason, latestSensorRecord] = await Promise.all([
      this.prisma.cropSeason.findFirst({
        where: { fieldId, status: { in: ['PLANNED', 'GROWING'] } },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
      }),
      (this.prisma as any).sensorRecord.findFirst({
        where: { fieldId },
        orderBy: { reportedAt: 'desc' }
      })
    ]);

    const deviceOnlineCount = field.devices.filter((device) => device.online || device.iotStatus === 'ONLINE').length;
    const deviceOfflineCount = field.devices.length - deviceOnlineCount;
    const soilMoisture = this.numberValue(latestSensorRecord?.soilMoisture ?? latestSensorRecord?.value);
    const temperature = this.numberValue(latestSensorRecord?.temperature);
    const humidity = this.numberValue(latestSensorRecord?.humidity);
    const riskLevel = this.riskLevel(soilMoisture, deviceOfflineCount, field.devices.length);

    return (this.prisma as any).fieldStateSnapshot.create({
      data: {
        fieldId,
        cropSeasonId: cropSeason?.id,
        latestSensorRecordId: latestSensorRecord?.id,
        soilMoisture,
        temperature,
        humidity,
        deviceOnlineCount,
        deviceOfflineCount,
        riskLevel,
        summary: {
          fieldName: field.name,
          cropName: cropSeason?.cropName,
          latestSensorReportedAt: latestSensorRecord?.reportedAt,
          deviceTotal: field.devices.length
        }
      }
    });
  }

  private numberValue(value: unknown) {
    if (value === null || value === undefined) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private riskLevel(soilMoisture: number | undefined, offlineCount: number, totalDevices: number) {
    if (soilMoisture !== undefined && (soilMoisture < 25 || soilMoisture > 75)) return 'CRITICAL';
    if (soilMoisture !== undefined && (soilMoisture < 35 || soilMoisture > 60)) return 'HIGH';
    if (totalDevices > 0 && offlineCount === totalDevices) return 'HIGH';
    if (offlineCount > 0) return 'LOW';
    return 'NORMAL';
  }
}
