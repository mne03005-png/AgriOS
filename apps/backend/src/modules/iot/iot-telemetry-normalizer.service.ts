import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type NormalizedWaterTelemetry = {
  soilMoisture?: number;
  soilTemperature?: number;
  airHumidity?: number;
  humidity?: number;
  pressureKpa?: number;
  flowRateM3h?: number;
  valveOpeningPercent?: number;
  pumpFrequencyHz?: number;
  pumpRunningStatus?: string;
  fertilizerTankLevelL?: number;
  waterTankLevelL?: number;
  batteryPercent?: number;
  signalStrength?: number;
};

@Injectable()
export class IotTelemetryNormalizerService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(payload: unknown): NormalizedWaterTelemetry {
    const root = this.asObject(payload);
    const telemetry = this.asObject(root.telemetry);
    const values = this.asObject(root.values);
    const source = { ...root, ...telemetry, ...values };
    return {
      soilMoisture: this.number(source.soilMoisture ?? source.moisture ?? source.soil_moisture),
      soilTemperature: this.number(source.soilTemperature ?? source.temp ?? source.temperature ?? source.soil_temperature),
      airHumidity: this.number(source.airHumidity ?? source.humidity ?? source.air_humidity),
      humidity: this.number(source.humidity),
      pressureKpa: this.number(source.pressureKpa ?? source.pressure ?? source.pressure_kpa),
      flowRateM3h: this.number(source.flowRateM3h ?? source.flowRate ?? source.flow_rate_m3h),
      valveOpeningPercent: this.number(source.valveOpeningPercent ?? source.valveOpening ?? source.valve_opening_percent),
      pumpFrequencyHz: this.number(source.pumpFrequencyHz ?? source.pumpFrequency ?? source.pump_frequency_hz),
      pumpRunningStatus: this.string(source.pumpRunningStatus ?? source.pumpStatus ?? source.pump_running_status),
      fertilizerTankLevelL: this.number(source.fertilizerTankLevelL ?? source.fertilizerTankLevel ?? source.fertilizer_tank_level_l),
      waterTankLevelL: this.number(source.waterTankLevelL ?? source.waterTankLevel ?? source.water_tank_level_l),
      batteryPercent: this.number(source.batteryPercent ?? source.battery ?? source.batteryLevel ?? source.battery_percent),
      signalStrength: this.number(source.signalStrength ?? source.rssi ?? source.signal ?? source.signal_strength)
    };
  }

  hasWaterTelemetry(normalized: NormalizedWaterTelemetry) {
    return Object.values(normalized).some((value) => value !== undefined && value !== null);
  }

  async upsertSnapshot(input: {
    tenantId?: string | null;
    farmId?: string | null;
    fieldId?: string | null;
    deviceId?: string | null;
    thingsboardDeviceId?: string | null;
    rawPayload?: unknown;
    reportedAt: Date;
    normalized: NormalizedWaterTelemetry;
  }) {
    if (!input.deviceId || !this.hasWaterTelemetry(input.normalized)) return null;
    const snapshotColumns = this.toSnapshotColumns(input.normalized);
    return (this.prisma as any).deviceTelemetrySnapshot.upsert({
      where: { deviceId: input.deviceId },
      create: {
        tenantId: input.tenantId,
        farmId: input.farmId,
        fieldId: input.fieldId,
        deviceId: input.deviceId,
        thingsboardDeviceId: input.thingsboardDeviceId,
        ...snapshotColumns,
        normalizedJson: input.normalized,
        rawPayload: input.rawPayload as any,
        reportedAt: input.reportedAt
      },
      update: {
        tenantId: input.tenantId,
        farmId: input.farmId,
        fieldId: input.fieldId,
        thingsboardDeviceId: input.thingsboardDeviceId,
        ...snapshotColumns,
        normalizedJson: input.normalized,
        rawPayload: input.rawPayload as any,
        reportedAt: input.reportedAt
      }
    });
  }

  async latestForFarm(farmId: string) {
    const snapshot = await (this.prisma as any).deviceTelemetrySnapshot.findFirst({
      where: { farmId },
      orderBy: { reportedAt: 'desc' }
    });
    const sensorRecord = await (this.prisma as any).sensorRecord.findFirst({
      where: { field: { farmId } },
      orderBy: { reportedAt: 'desc' },
      include: { device: true, field: true }
    });
    return { snapshot, sensorRecord };
  }

  async latestForDevice(deviceId: string) {
    const snapshot = await (this.prisma as any).deviceTelemetrySnapshot.findUnique({ where: { deviceId } });
    if (snapshot) return snapshot;
    return (this.prisma as any).sensorRecord.findFirst({ where: { deviceId }, orderBy: { reportedAt: 'desc' } });
  }

  async farmSummary(farmId: string) {
    const snapshots = await (this.prisma as any).deviceTelemetrySnapshot.findMany({ where: { farmId }, orderBy: { reportedAt: 'desc' } });
    const avg = (key: string) => {
      const values: number[] = snapshots.map((item: any) => Number(item[key])).filter((value: number) => Number.isFinite(value));
      return values.length ? Number((values.reduce((sum: number, value: number) => sum + value, 0) / values.length).toFixed(2)) : null;
    };
    return {
      farmId,
      deviceCount: snapshots.length,
      pressureSummary: { avgKpa: avg('pressureKpa'), latest: snapshots.find((item: any) => item.pressureKpa !== null) ?? null },
      flowSummary: { avgM3h: avg('flowRateM3h'), latest: snapshots.find((item: any) => item.flowRateM3h !== null) ?? null },
      pumpStatus: snapshots.filter((item: any) => item.pumpRunningStatus).map((item: any) => ({ deviceId: item.deviceId, status: item.pumpRunningStatus, reportedAt: item.reportedAt })),
      tankLevelWarnings: snapshots
        .filter((item: any) => Number(item.fertilizerTankLevelL ?? item.waterTankLevelL) < 20)
        .map((item: any) => ({ deviceId: item.deviceId, fertilizerTankLevelL: item.fertilizerTankLevelL, waterTankLevelL: item.waterTankLevelL }))
    };
  }

  private toSnapshotColumns(normalized: NormalizedWaterTelemetry) {
    return {
      pressureKpa: normalized.pressureKpa,
      flowRateM3h: normalized.flowRateM3h,
      valveOpeningPercent: normalized.valveOpeningPercent,
      pumpFrequencyHz: normalized.pumpFrequencyHz,
      pumpRunningStatus: normalized.pumpRunningStatus,
      fertilizerTankLevelL: normalized.fertilizerTankLevelL,
      waterTankLevelL: normalized.waterTankLevelL,
      batteryPercent: normalized.batteryPercent,
      signalStrength: normalized.signalStrength
    };
  }

  private asObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private number(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private string(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
