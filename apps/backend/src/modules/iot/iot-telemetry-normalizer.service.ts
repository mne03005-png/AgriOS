import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

export type NormalizedWaterTelemetry = {
  soilMoisture?: number;
  soilTemperature?: number;
  airTemperature?: number;
  airHumidity?: number;
  humidity?: number;
  lightLux?: number;
  co2Ppm?: number;
  pressureKpa?: number;
  flowRateM3h?: number;
  waterLevel?: number;
  valveOpeningPercent?: number;
  pumpFrequencyHz?: number;
  pumpRunningStatus?: string;
  fertilizerTankLevelL?: number;
  waterTankLevelL?: number;
  batteryPercent?: number;
  signalStrength?: number;
  gatewayOnline?: boolean;
};
export type TelemetryQualityStatus = 'GOOD' | 'WARNING' | 'INVALID' | 'STALE' | 'DUPLICATE' | 'CLOCK_DRIFT';
export type TelemetryQuality = { status: TelemetryQualityStatus; score: number; warnings: string[] };

@Injectable()
export class IotTelemetryNormalizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  normalize(payload: unknown): NormalizedWaterTelemetry {
    const root = this.asObject(payload);
    const telemetry = this.asObject(root.telemetry);
    const values = this.asObject(root.values);
    const source = { ...root, ...telemetry, ...values };
    return {
      soilMoisture: this.number(source.soilMoisture ?? source.moisture ?? source.soil_moisture),
      soilTemperature: this.number(source.soilTemperature ?? source.temp ?? source.temperature ?? source.soil_temperature),
      airTemperature: this.number(source.airTemperature ?? source.airTemp ?? source.air_temperature),
      airHumidity: this.number(source.airHumidity ?? source.humidity ?? source.air_humidity),
      humidity: this.number(source.humidity),
      lightLux: this.number(source.lightLux ?? source.illuminance ?? source.light_lux),
      co2Ppm: this.number(source.co2Ppm ?? source.co2 ?? source.co2_ppm),
      pressureKpa: this.pressureKpa(source),
      flowRateM3h: this.flowRateM3h(source),
      waterLevel: this.number(source.waterLevel ?? source.waterLevelPercent ?? source.water_level),
      valveOpeningPercent: this.number(source.valveOpeningPercent ?? source.valveOpening ?? source.valve_opening_percent),
      pumpFrequencyHz: this.number(source.pumpFrequencyHz ?? source.pumpFrequency ?? source.pump_frequency_hz),
      pumpRunningStatus: this.string(source.pumpRunningStatus ?? source.pumpStatus ?? source.pump_running_status),
      fertilizerTankLevelL: this.number(source.fertilizerTankLevelL ?? source.fertilizerTankLevel ?? source.fertilizer_tank_level_l),
      waterTankLevelL: this.number(source.waterTankLevelL ?? source.waterTankLevel ?? source.water_tank_level_l),
      batteryPercent: this.number(source.batteryPercent ?? source.battery ?? source.batteryLevel ?? source.battery_percent),
      signalStrength: this.number(source.signalStrength ?? source.rssi ?? source.signal ?? source.signal_strength),
      gatewayOnline: this.boolean(source.gatewayOnline ?? source.gateway_online)
    };
  }

  assessQuality(normalized: NormalizedWaterTelemetry, reportedAt: Date, duplicate = false, receivedAt = new Date()): TelemetryQuality {
    const warnings: string[] = [];
    let score = 100;
    let status: TelemetryQualityStatus = 'GOOD';
    const mark = (next: TelemetryQualityStatus, points: number, message: string) => {
      warnings.push(message);
      score = Math.max(0, score - points);
      if (this.priority(next) > this.priority(status)) status = next;
    };

    if (duplicate) mark('DUPLICATE', 45, 'Telemetry duplicates an existing event or sample.');
    if (!this.hasWaterTelemetry(normalized)) mark('INVALID', 80, 'Telemetry contains no supported numeric or status fields.');
    const ageMs = receivedAt.getTime() - reportedAt.getTime();
    if (ageMs > 24 * 60 * 60 * 1000) mark('STALE', 35, 'Telemetry timestamp is older than 24 hours.');
    if (ageMs < -5 * 60 * 1000) mark('CLOCK_DRIFT', 40, 'Telemetry timestamp is more than 5 minutes in the future.');
    this.range(normalized.soilMoisture, 0, 100, 'soilMoisture', mark);
    this.range(normalized.soilTemperature, -30, 80, 'soilTemperature', mark);
    this.range(normalized.airTemperature, -40, 80, 'airTemperature', mark);
    this.range(normalized.airHumidity, 0, 100, 'airHumidity', mark);
    this.range(normalized.lightLux, 0, 200000, 'lightLux', mark);
    this.range(normalized.co2Ppm, 0, 10000, 'co2Ppm', mark);
    this.range(normalized.pressureKpa, 0, 2000, 'pressureKpa', mark);
    this.range(normalized.flowRateM3h, 0, 10000, 'flowRateM3h', mark);
    this.range(normalized.waterLevel, 0, 100, 'waterLevel', mark);
    this.range(normalized.valveOpeningPercent, 0, 100, 'valveOpeningPercent', mark);
    this.range(normalized.pumpFrequencyHz, 0, 80, 'pumpFrequencyHz', mark);
    this.range(normalized.fertilizerTankLevelL, 0, 100000, 'fertilizerTankLevelL', mark);
    this.range(normalized.waterTankLevelL, 0, 100000, 'waterTankLevelL', mark);
    this.range(normalized.batteryPercent, 0, 100, 'batteryPercent', mark);
    this.range(normalized.signalStrength, -140, 100, 'signalStrength', mark);
    if (warnings.length > 0 && status === 'GOOD') status = 'WARNING';
    return { status, score, warnings };
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
    source?: string | null;
    receivedAt?: Date;
    quality?: TelemetryQuality;
  }) {
    if (!input.deviceId || !this.hasWaterTelemetry(input.normalized)) return null;
    const snapshotColumns = this.toSnapshotColumns(input.normalized);
    const quality = input.quality ?? this.assessQuality(input.normalized, input.reportedAt, false, input.receivedAt);
    return (this.prisma as any).deviceTelemetrySnapshot.upsert({
      where: { deviceId: input.deviceId },
      create: {
        tenantId: input.tenantId,
        farmId: input.farmId,
        fieldId: input.fieldId,
        deviceId: input.deviceId,
        thingsboardDeviceId: input.thingsboardDeviceId,
        ...snapshotColumns,
        source: input.source ?? 'thingsboard',
        normalizedJson: input.normalized,
        rawPayload: input.rawPayload as any,
        reportedAt: input.reportedAt,
        receivedAt: input.receivedAt ?? new Date(),
        qualityStatus: quality.status,
        qualityScore: quality.score
      },
      update: {
        tenantId: input.tenantId,
        farmId: input.farmId,
        fieldId: input.fieldId,
        thingsboardDeviceId: input.thingsboardDeviceId,
        ...snapshotColumns,
        source: input.source ?? 'thingsboard',
        normalizedJson: input.normalized,
        rawPayload: input.rawPayload as any,
        reportedAt: input.reportedAt,
        receivedAt: input.receivedAt ?? new Date(),
        qualityStatus: quality.status,
        qualityScore: quality.score
      }
    });
  }

  async latestForFarm(farmId: string, includeRaw = false) {
    const snapshot = await (this.prisma as any).deviceTelemetrySnapshot.findFirst({
      where: this.tenantWhere({ farmId }),
      orderBy: { reportedAt: 'desc' }
    });
    const sensorRecord = await (this.prisma as any).sensorRecord.findFirst({
      where: this.tenantWhere({ field: { farmId } }),
      orderBy: { reportedAt: 'desc' },
      include: { device: true, field: true }
    });
    return { snapshot: this.sanitizeRaw(snapshot, includeRaw), sensorRecord: this.sanitizeRaw(sensorRecord, includeRaw) };
  }

  async latestForDevice(deviceId: string, includeRaw = false) {
    const where = this.tenantWhere({ deviceId });
    const snapshot = await (this.prisma as any).deviceTelemetrySnapshot.findFirst({ where });
    if (snapshot) return this.sanitizeRaw(snapshot, includeRaw);
    const sensor = await (this.prisma as any).sensorRecord.findFirst({ where, orderBy: { reportedAt: 'desc' } });
    return this.sanitizeRaw(sensor, includeRaw);
  }

  async historyForDevice(deviceId: string, query: Record<string, unknown> = {}, includeRaw = false) {
    const { from, to } = this.timeRange(query);
    const pageSize = Math.min(this.positiveInt(query.pageSize, 100), 500);
    const items = await (this.prisma as any).sensorRecord.findMany({
      where: this.tenantWhere({ deviceId, reportedAt: { gte: from, lte: to } }),
      orderBy: { reportedAt: 'desc' },
      take: pageSize
    });
    return { from, to, pageSize, items: items.map((item: any) => this.sanitizeRaw(item, includeRaw)) };
  }

  async farmSummary(farmId: string) {
    const snapshots = await (this.prisma as any).deviceTelemetrySnapshot.findMany({ where: this.tenantWhere({ farmId }), orderBy: { reportedAt: 'desc' } });
    const avg = (key: string) => {
      const values: number[] = snapshots.map((item: any) => Number(item[key])).filter((value: number) => Number.isFinite(value));
      return values.length ? Number((values.reduce((sum: number, value: number) => sum + value, 0) / values.length).toFixed(2)) : null;
    };
    return {
      farmId,
      deviceCount: snapshots.length,
      quality: {
        avgScore: avg('qualityScore'),
        warningCount: snapshots.filter((item: any) => item.qualityStatus && item.qualityStatus !== 'GOOD').length
      },
      pressureSummary: { avgKpa: avg('pressureKpa'), latest: snapshots.find((item: any) => item.pressureKpa !== null) ?? null },
      flowSummary: { avgM3h: avg('flowRateM3h'), latest: snapshots.find((item: any) => item.flowRateM3h !== null) ?? null },
      pumpStatus: snapshots.filter((item: any) => item.pumpRunningStatus).map((item: any) => ({ deviceId: item.deviceId, status: item.pumpRunningStatus, reportedAt: item.reportedAt })),
      tankLevelWarnings: snapshots
        .filter((item: any) => Number(item.fertilizerTankLevelL ?? item.waterTankLevelL) < 20)
        .map((item: any) => ({ deviceId: item.deviceId, fertilizerTankLevelL: item.fertilizerTankLevelL, waterTankLevelL: item.waterTankLevelL }))
    };
  }

  async fieldSummary(fieldId: string) {
    const snapshots = await (this.prisma as any).deviceTelemetrySnapshot.findMany({
      where: this.tenantWhere({ fieldId }),
      orderBy: { reportedAt: 'desc' },
      take: 100
    });
    const latest = snapshots[0] ?? null;
    return {
      fieldId,
      deviceCount: new Set(snapshots.map((item: any) => item.deviceId)).size,
      latest: this.sanitizeRaw(latest, false),
      quality: {
        warningCount: snapshots.filter((item: any) => item.qualityStatus && item.qualityStatus !== 'GOOD').length,
        avgScore: this.average(snapshots.map((item: any) => Number(item.qualityScore)))
      }
    };
  }

  private toSnapshotColumns(normalized: NormalizedWaterTelemetry) {
    return {
      soilMoisture: normalized.soilMoisture,
      soilTemperature: normalized.soilTemperature,
      airTemperature: normalized.airTemperature,
      airHumidity: normalized.airHumidity,
      lightLux: normalized.lightLux,
      co2Ppm: normalized.co2Ppm,
      pressureKpa: normalized.pressureKpa,
      flowRateM3h: normalized.flowRateM3h,
      waterLevel: normalized.waterLevel,
      valveOpeningPercent: normalized.valveOpeningPercent,
      pumpFrequencyHz: normalized.pumpFrequencyHz,
      pumpRunningStatus: normalized.pumpRunningStatus,
      fertilizerTankLevelL: normalized.fertilizerTankLevelL,
      waterTankLevelL: normalized.waterTankLevelL,
      batteryPercent: normalized.batteryPercent,
      signalStrength: normalized.signalStrength,
      gatewayOnline: normalized.gatewayOnline
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

  private pressureKpa(source: Record<string, unknown>) {
    const kpa = this.number(source.pressureKpa ?? source.pressure_kpa);
    if (kpa !== undefined) return kpa;
    const pa = this.number(source.pressurePa ?? source.pressure_pa);
    if (pa !== undefined) return Number((pa / 1000).toFixed(3));
    return this.number(source.pressure);
  }

  private flowRateM3h(source: Record<string, unknown>) {
    const m3h = this.number(source.flowRateM3h ?? source.flow_rate_m3h);
    if (m3h !== undefined) return m3h;
    const lps = this.number(source.flowRateLps ?? source.flow_lps);
    if (lps !== undefined) return Number((lps * 3.6).toFixed(3));
    return this.number(source.flowRate);
  }

  private string(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private boolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (['true', 'online', '1'].includes(value.toLowerCase())) return true;
      if (['false', 'offline', '0'].includes(value.toLowerCase())) return false;
    }
    return undefined;
  }

  private range(value: number | undefined, min: number, max: number, key: string, mark: (status: TelemetryQualityStatus, points: number, message: string) => void) {
    if (value === undefined) return;
    if (value < min || value > max) mark('WARNING', 20, `${key} is outside expected range ${min}-${max}.`);
  }

  private priority(status: TelemetryQualityStatus) {
    return { GOOD: 0, WARNING: 1, STALE: 2, CLOCK_DRIFT: 3, DUPLICATE: 4, INVALID: 5 }[status];
  }

  private timeRange(query: Record<string, unknown>) {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const from = typeof query.from === 'string' ? new Date(query.from) : defaultFrom;
    const to = typeof query.to === 'string' ? new Date(query.to) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { from: defaultFrom, to: now };
    const maxSpanMs = 7 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxSpanMs) return { from: new Date(to.getTime() - maxSpanMs), to };
    return { from, to };
  }

  private positiveInt(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }

  private average(values: number[]) {
    const finite = values.filter((value) => Number.isFinite(value));
    return finite.length ? Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(2)) : null;
  }

  private tenantWhere<T extends Record<string, unknown>>(where: T) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId || this.requestContext.isPlatformAdmin()) return where;
    return { ...where, tenantId };
  }

  private sanitizeRaw(item: any, includeRaw: boolean) {
    if (!item || includeRaw) return item;
    const { rawPayload: _rawPayload, ...rest } = item;
    return rest;
  }
}
