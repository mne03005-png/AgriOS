import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IrrigationRuleService } from '../irrigation-rule/irrigation-rule.service';
import { IrrigationMonitoringService } from '../irrigation-monitoring/irrigation-monitoring.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { ThingsBoardTelemetryDto } from './dto/thingsboard-telemetry.dto';
import { IotDeviceService } from './iot-device.service';
import { IotTelemetryNormalizerService } from './iot-telemetry-normalizer.service';
import { IotWebhookDeadLetterService } from './iot-webhook-dead-letter.service';

type NormalizedTelemetry = {
  deviceName?: string;
  thingsboardDeviceId?: string;
  soilMoisture?: number;
  soilTemperature?: number;
  temperature?: number;
  airHumidity?: number;
  humidity?: number;
  batteryPercent?: number;
  battery?: number;
  signalStrength?: number;
  recordedAt: Date;
  primaryType: 'SOIL_MOISTURE' | 'TEMPERATURE' | 'HUMIDITY';
  primaryValue: number;
  primaryUnit: string;
  rawPayload: unknown;
  warnings: string[];
};

@Injectable()
export class ThingsBoardWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly iotDeviceService: IotDeviceService,
    private readonly irrigationRuleService: IrrigationRuleService,
    private readonly irrigationMonitoringService: IrrigationMonitoringService,
    private readonly operationLogService: OperationLogService,
    private readonly telemetryNormalizerService: IotTelemetryNormalizerService,
    private readonly deadLetterService: IotWebhookDeadLetterService
  ) {}

  async handleTelemetry(secret: string | undefined, dto: ThingsBoardTelemetryDto) {
    this.validateSecret(secret);
    return this.processTelemetry(dto);
  }

  async replayTelemetry(dto: ThingsBoardTelemetryDto) {
    return this.processTelemetry(dto);
  }

  async previewTelemetry(dto: ThingsBoardTelemetryDto) {
    const normalized = this.normalize(dto);
    const { device, plotId } = await this.iotDeviceService.resolvePlotBinding({
      deviceName: normalized.deviceName,
      thingsboardDeviceId: normalized.thingsboardDeviceId
    });
    const duplicated = await this.findDuplicatedSensorRecord(device?.id, normalized);
    const mayCreateIrrigationAdvice =
      Boolean(plotId) &&
      typeof normalized.soilMoisture === 'number' &&
      (normalized.soilMoisture < 35 || normalized.soilMoisture > 60) &&
      !duplicated;

    return {
      deviceName: normalized.deviceName,
      thingsboardDeviceId: normalized.thingsboardDeviceId,
      parsed: {
        soilMoisture: normalized.soilMoisture,
        soilTemperature: normalized.soilTemperature,
        temperature: normalized.temperature,
        airHumidity: normalized.airHumidity,
        humidity: normalized.humidity,
        batteryPercent: normalized.batteryPercent,
        battery: normalized.battery,
        signalStrength: normalized.signalStrength,
        recordedAt: normalized.recordedAt
      },
      deviceMatched: Boolean(device),
      deviceId: device?.id ?? null,
      plotId,
      bindingSource: device?.bindingSource ?? null,
      duplicatedTelemetryLikely: Boolean(duplicated),
      matchedExistingSensorRecordId: duplicated?.id ?? null,
      mayCreateIrrigationAdvice,
      warnings: [
        ...normalized.warnings,
        ...(plotId ? [] : ['Device is not bound to a field; advice would not be generated.']),
        ...(duplicated ? ['Telemetry appears duplicated and would be skipped.'] : [])
      ]
    };
  }

  private async processTelemetry(dto: ThingsBoardTelemetryDto) {
    let normalized: NormalizedTelemetry;
    try {
      normalized = this.normalize(dto);
    } catch (error) {
      const deadLetter = await this.safeCreateDeadLetter(dto, 'telemetry', undefined, undefined, error);
      return {
        accepted: false,
        saved: false,
        duplicated: false,
        warning: 'Telemetry payload could not be normalized.',
        deadLetterId: deadLetter?.id ?? null
      };
    }

    if (normalized.warnings.length > 0 && !this.hasAnyMetric(normalized)) {
      const deadLetter = await this.safeCreateDeadLetter(
        dto,
        'telemetry',
        normalized.deviceName,
        normalized.thingsboardDeviceId,
        new Error(normalized.warnings.join('; '))
      );
      return {
        accepted: false,
        saved: false,
        duplicated: false,
        warnings: normalized.warnings,
        deadLetterId: deadLetter?.id ?? null
      };
    }

    try {
      const { device, plotId, farmId } = await this.iotDeviceService.resolvePlotBinding({
        deviceName: normalized.deviceName,
        thingsboardDeviceId: normalized.thingsboardDeviceId
      });
      const waterTelemetry = this.telemetryNormalizerService.normalize(dto);

      const duplicated = await this.findDuplicatedSensorRecord(device?.id, normalized);
      if (duplicated) {
        return {
          accepted: true,
          saved: false,
          duplicated: true,
          deviceMatched: Boolean(device),
          fieldBound: Boolean(plotId),
          sensorRecordId: duplicated.id,
          adviceCreated: false,
          irrigationAdviceCreated: false,
          adviceId: null,
          duplicatedTelemetry: true,
          skippedReason: 'Duplicated telemetry was skipped.',
          warnings: normalized.warnings
        };
      }

      const sensorRecord = await (this.prisma as any).sensorRecord.create({
        data: {
          tenantId: device?.tenantId,
          deviceId: device?.id,
          fieldId: plotId,
          deviceName: normalized.deviceName,
          thingsboardDeviceId: normalized.thingsboardDeviceId,
          type: normalized.primaryType,
          value: normalized.primaryValue,
          unit: normalized.primaryUnit,
          soilMoisture: normalized.soilMoisture,
          temperature: normalized.soilTemperature ?? normalized.temperature,
          humidity: normalized.airHumidity ?? normalized.humidity,
          battery: normalized.batteryPercent ?? normalized.battery,
          rawPayload: normalized.rawPayload,
          normalizedJson: waterTelemetry,
          source: 'thingsboard',
          reportedAt: normalized.recordedAt
        }
      });

      const telemetrySnapshot = await this.telemetryNormalizerService.upsertSnapshot({
        tenantId: device?.tenantId,
        farmId,
        fieldId: plotId,
        deviceId: device?.id,
        thingsboardDeviceId: normalized.thingsboardDeviceId,
        rawPayload: normalized.rawPayload,
        reportedAt: normalized.recordedAt,
        normalized: waterTelemetry
      });
      if (telemetrySnapshot) {
        await this.irrigationMonitoringService.evaluate(telemetrySnapshot);
      }

      if (device) {
        await (this.prisma as any).device.update({
          where: { id: device.id },
          data: {
            lastTelemetryAt: normalized.recordedAt,
            lastReportedAt: normalized.recordedAt,
            iotStatus: 'ONLINE',
            online: true
          }
        });
      }

      await this.operationLogService.create({
        action: 'THINGSBOARD_TELEMETRY_RECEIVED',
        targetType: 'SENSOR_RECORD',
        targetId: sensorRecord.id,
        description: 'ThingsBoard telemetry received',
        metadata: {
          fieldId: plotId,
          plotId,
          deviceName: normalized.deviceName,
          thingsboardDeviceId: normalized.thingsboardDeviceId,
          soilMoisture: normalized.soilMoisture,
          soilTemperature: normalized.soilTemperature,
          temperature: normalized.temperature,
          airHumidity: normalized.airHumidity,
          humidity: normalized.humidity,
          batteryPercent: normalized.batteryPercent,
          signalStrength: normalized.signalStrength,
          warnings: normalized.warnings,
          warning: plotId ? undefined : 'Device is not bound to a field; advice was not generated.'
        }
      });
      await this.syncAuditServiceSafe(dto, normalized, Boolean(sensorRecord), Boolean(telemetrySnapshot), normalized.warnings);

      let irrigationAdvice: any = null;
      let adviceWarning: string | null = null;
      if (plotId && typeof normalized.soilMoisture === 'number') {
        try {
          irrigationAdvice = await this.createAdviceIfNeeded(plotId, device?.id, normalized.soilMoisture);
        } catch (error) {
          adviceWarning = 'Irrigation advice evaluation failed; telemetry was saved.';
          await this.safeCreateDeadLetter(dto, 'irrigation-advice', normalized.deviceName, normalized.thingsboardDeviceId, error);
        }
      }

      return {
        accepted: true,
        saved: true,
        duplicated: false,
        deviceMatched: Boolean(device),
        fieldBound: Boolean(plotId),
        sensorRecordId: sensorRecord.id,
        adviceCreated: Boolean(irrigationAdvice),
        irrigationAdviceCreated: Boolean(irrigationAdvice),
        adviceId: irrigationAdvice?.id ?? null,
        duplicatedTelemetry: false,
        skippedReason: irrigationAdvice ? null : plotId ? 'No new irrigation advice was needed.' : 'Device is not bound to a field.',
        warnings: [
          ...normalized.warnings,
          ...(plotId ? [] : ['Device is not bound to a field; advice was not generated.']),
          ...(adviceWarning ? [adviceWarning] : [])
        ]
      };
    } catch (error) {
      const deadLetter = await this.safeCreateDeadLetter(
        dto,
        'telemetry',
        normalized.deviceName,
        normalized.thingsboardDeviceId,
        error
      );
      return {
        accepted: false,
        saved: false,
        duplicated: false,
        warnings: ['Telemetry processing failed.'],
        deadLetterId: deadLetter?.id ?? null
      };
    }
  }

  private validateSecret(secret?: string) {
    const expected = process.env.THINGSBOARD_WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid ThingsBoard webhook secret');
    }
  }

  private normalize(dto: ThingsBoardTelemetryDto): NormalizedTelemetry {
    const telemetry = this.objectValue((dto as any).telemetry);
    const values = this.objectValue(dto.values);
    const metadata = this.objectValue(dto.metadata);
    const source = { ...(dto as any), ...telemetry, ...values };
    const warnings: string[] = [];
    const soilMoisture = this.numberValue(source.soilMoisture ?? source.moisture ?? source.soil_moisture, 'soilMoisture', warnings);
    const soilTemperature = this.numberValue(
      source.soilTemperature ?? source.temp ?? source.temperature ?? source.soil_temperature,
      'soilTemperature',
      warnings
    );
    const temperature = soilTemperature;
    const airHumidity = this.numberValue(source.airHumidity ?? source.humidity ?? source.air_humidity, 'airHumidity', warnings);
    const humidity = airHumidity;
    const batteryPercent = this.numberValue(
      source.batteryPercent ?? source.battery ?? source.batteryLevel ?? source.battery_percent,
      'batteryPercent',
      warnings
    );
    const battery = batteryPercent;
    const signalStrength = this.numberValue(source.signalStrength ?? source.rssi ?? source.signal ?? source.signal_strength, 'signalStrength', warnings);
    const recordedAt = this.dateValue(dto.ts, warnings);
    const primary =
      soilMoisture !== undefined
        ? { type: 'SOIL_MOISTURE' as const, value: soilMoisture, unit: '%' }
        : soilTemperature !== undefined
          ? { type: 'TEMPERATURE' as const, value: soilTemperature, unit: 'C' }
          : airHumidity !== undefined
            ? { type: 'HUMIDITY' as const, value: airHumidity, unit: '%' }
            : { type: 'TEMPERATURE' as const, value: 0, unit: '' };

    return {
      deviceName: this.stringValue(dto.deviceName ?? (dto as any).thingsboardDeviceName ?? metadata.deviceName),
      thingsboardDeviceId: this.stringValue(dto.thingsboardDeviceId ?? dto.deviceId ?? metadata.thingsboardDeviceId ?? metadata.deviceId),
      soilMoisture,
      soilTemperature,
      temperature,
      airHumidity,
      humidity,
      batteryPercent,
      battery,
      signalStrength,
      recordedAt,
      primaryType: primary.type,
      primaryValue: primary.value,
      primaryUnit: primary.unit,
      rawPayload: dto.rawPayload ?? dto,
      warnings
    };
  }

  private numberValue(value: unknown, key: string, warnings: string[]) {
    if (value === undefined || value === null || value === '') return undefined;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    warnings.push(`${key} is not a valid number and was ignored.`);
    return undefined;
  }

  private dateValue(value: unknown, warnings: string[]) {
    if (value === undefined || value === null || value === '') return new Date();
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      const number = Number(value);
      const timestamp = number < 10_000_000_000 ? number * 1000 : number;
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    warnings.push('ts is invalid; current time was used.');
    return new Date();
  }

  private hasAnyMetric(normalized: NormalizedTelemetry) {
    return (
      normalized.soilMoisture !== undefined ||
      normalized.soilTemperature !== undefined ||
      normalized.temperature !== undefined ||
      normalized.airHumidity !== undefined ||
      normalized.humidity !== undefined ||
      normalized.batteryPercent !== undefined ||
      normalized.battery !== undefined ||
      normalized.signalStrength !== undefined
    );
  }

  private findDuplicatedSensorRecord(deviceId: string | undefined, normalized: NormalizedTelemetry) {
    const identityWhere = [
      ...(deviceId ? [{ deviceId }] : []),
      ...(normalized.thingsboardDeviceId ? [{ thingsboardDeviceId: normalized.thingsboardDeviceId }] : []),
      ...(normalized.deviceName ? [{ deviceName: normalized.deviceName }] : [])
    ];
    if (identityWhere.length === 0) return null;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return (this.prisma as any).sensorRecord.findFirst({
      where: {
        reportedAt: normalized.recordedAt,
        soilMoisture: normalized.soilMoisture,
        createdAt: { gte: fiveMinutesAgo },
        OR: identityWhere
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async createAdviceIfNeeded(plotId: string, deviceId: string | undefined, soilMoisture: number) {
    const evaluation = this.irrigationRuleService.evaluate({ fieldId: plotId, soilMoisture });
    if (evaluation.action !== 'SHOULD_IRRIGATE' && evaluation.action !== 'STOP_IRRIGATION') return null;

    const recent = await (this.prisma as any).irrigationAdvice.findFirst({
      where: {
        fieldId: plotId,
        status: 'PENDING',
        action: evaluation.action,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (recent) return null;

    const currentCropSeason = await this.prisma.cropSeason.findFirst({
      where: { fieldId: plotId, status: { in: ['PLANNED', 'GROWING'] } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
    });
    const advice = await (this.prisma as any).irrigationAdvice.create({
      data: {
        fieldId: plotId,
        deviceId,
        cropSeasonId: currentCropSeason?.id,
        soilMoisture,
        action: evaluation.action,
        message: evaluation.message,
        source: 'THINGSBOARD',
        status: 'PENDING'
      }
    });

    await this.operationLogService.create({
      action: 'IRRIGATION_ADVICE_CREATED_FROM_TELEMETRY',
      targetType: 'IRRIGATION_ADVICE',
      targetId: advice.id,
      description: 'Irrigation advice created from ThingsBoard telemetry',
      metadata: { fieldId: plotId, plotId, soilMoisture, reason: advice.message }
    });
    return advice;
  }

  private safeCreateDeadLetter(
    payload: unknown,
    eventType: string,
    deviceName: string | undefined,
    thingsboardDeviceId: string | undefined,
    error: unknown
  ) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    return this.deadLetterService
      .create({
        eventType,
        deviceName,
        thingsboardDeviceId,
        rawPayload: payload,
        errorMessage: normalizedError.message,
        errorStack: normalizedError.stack
      })
      .catch(() => null);
  }

  private syncAuditServiceSafe(
    payload: unknown,
    normalized: NormalizedTelemetry,
    sensorRecordCreated: boolean,
    snapshotUpdated: boolean,
    warnings: string[]
  ) {
    return this.iotDeviceService
      .recordTelemetryAudit({
        payload,
        deviceName: normalized.deviceName,
        thingsboardDeviceId: normalized.thingsboardDeviceId,
        sensorRecordCreated,
        snapshotUpdated,
        warnings
      })
      .catch(() => null);
  }

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
