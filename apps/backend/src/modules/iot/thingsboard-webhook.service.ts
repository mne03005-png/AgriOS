import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
  eventId?: string;
  source: string;
  receivedAt: Date;
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

  async handleTelemetry(
    secret: string | undefined,
    dto: ThingsBoardTelemetryDto,
    meta: { signature?: string; timestamp?: string; eventId?: string; contentLength?: string } = {}
  ) {
    await this.validateWebhook(secret, dto, meta);
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
      const eventDuplicate = normalized.eventId ? await this.findDuplicatedEvent(normalized.eventId) : null;
      if (eventDuplicate) {
        return {
          accepted: true,
          saved: false,
          duplicated: true,
          eventId: normalized.eventId,
          sensorRecordId: eventDuplicate.id,
          adviceCreated: false,
          irrigationAdviceCreated: false,
          adviceId: null,
          duplicatedTelemetry: true,
          skippedReason: 'Duplicated eventId was skipped.',
          warnings: ['Duplicate eventId was received.']
        };
      }

      const { device, plotId, farmId } = await this.iotDeviceService.resolvePlotBinding({
        deviceName: normalized.deviceName,
        thingsboardDeviceId: normalized.thingsboardDeviceId
      });
      const waterTelemetry = this.telemetryNormalizerService.normalize(dto);

      const duplicated = await this.findDuplicatedSensorRecord(device?.id, normalized);
      const quality = this.telemetryNormalizerService.assessQuality(waterTelemetry, normalized.recordedAt, Boolean(duplicated), normalized.receivedAt);
      if (!device || !plotId) {
        const deadLetter = await this.safeCreateDeadLetter(
          dto,
          !device ? 'unbound-device' : 'unbound-field',
          normalized.deviceName,
          normalized.thingsboardDeviceId,
          new Error(!device ? 'Telemetry device is not bound to AgriOS.' : 'Telemetry device is not bound to a field.'),
          normalized.eventId,
          normalized.source
        );
        return {
          accepted: false,
          saved: false,
          duplicated: false,
          deviceMatched: Boolean(device),
          fieldBound: Boolean(plotId),
          deadLetterId: deadLetter?.id ?? null,
          adviceCreated: false,
          irrigationAdviceCreated: false,
          adviceId: null,
          skippedReason: !device ? 'Device is not bound to AgriOS.' : 'Device is not bound to a field.',
          warnings: [...normalized.warnings, ...quality.warnings]
        };
      }

      const sensorRecord = await (this.prisma as any).sensorRecord.create({
        data: {
          tenantId: device?.tenantId,
          farmId,
          deviceId: device?.id,
          fieldId: plotId,
          eventId: normalized.eventId,
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
          source: normalized.source,
          reportedAt: normalized.recordedAt,
          receivedAt: normalized.receivedAt,
          qualityStatus: quality.status,
          qualityScore: quality.score
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
        receivedAt: normalized.receivedAt,
        normalized: waterTelemetry,
        source: normalized.source,
        quality
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
          qualityStatus: quality.status,
          qualityScore: quality.score,
          warnings: [...normalized.warnings, ...quality.warnings],
          warning: plotId ? undefined : 'Device is not bound to a field; advice was not generated.'
        }
      });
      await this.syncAuditServiceSafe(dto, normalized, Boolean(sensorRecord), Boolean(telemetrySnapshot), [...normalized.warnings, ...quality.warnings]);

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
          ...quality.warnings,
          ...(adviceWarning ? [adviceWarning] : [])
        ]
      };
    } catch (error) {
      const deadLetter = await this.safeCreateDeadLetter(
        dto,
        'telemetry',
        normalized.deviceName,
        normalized.thingsboardDeviceId,
        error,
        normalized.eventId,
        normalized.source
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

  private async validateWebhook(secret: string | undefined, dto: ThingsBoardTelemetryDto, meta: { signature?: string; timestamp?: string; eventId?: string; contentLength?: string }) {
    const bytes = Number(meta.contentLength ?? Buffer.byteLength(JSON.stringify(dto)));
    if (Number.isFinite(bytes) && bytes > 256 * 1024) throw new BadRequestException('Telemetry payload is too large');
    this.validateSecret(secret);
    this.validateHmac(dto, meta.signature, meta.timestamp);
    const eventId = this.stringValue(meta.eventId ?? dto.eventId);
    if (eventId && (await this.findDuplicatedEvent(eventId))) return;
  }

  private validateSecret(secret?: string) {
    const expected = process.env.THINGSBOARD_WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid webhook credentials');
    }
  }

  private validateHmac(dto: ThingsBoardTelemetryDto, signature?: string, timestamp?: string) {
    const secret = process.env.THINGSBOARD_WEBHOOK_HMAC_SECRET ?? process.env.THINGSBOARD_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('Invalid webhook credentials');
    if (!signature || !timestamp) throw new UnauthorizedException('Invalid webhook credentials');
    const time = Number(timestamp);
    if (!Number.isFinite(time)) throw new UnauthorizedException('Invalid webhook credentials');
    const timeMs = time < 10_000_000_000 ? time * 1000 : time;
    if (Math.abs(Date.now() - timeMs) > 5 * 60 * 1000) throw new UnauthorizedException('Invalid webhook credentials');
    const payload = `${timestamp}.${JSON.stringify(dto)}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const left = Buffer.from(expected);
    const right = Buffer.from(normalized);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException('Invalid webhook credentials');
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
      eventId: this.stringValue(dto.eventId ?? source.eventId ?? metadata.eventId),
      source: this.stringValue(dto.source ?? source.source ?? metadata.source) ?? 'thingsboard',
      soilMoisture,
      soilTemperature,
      temperature,
      airHumidity,
      humidity,
      batteryPercent,
      battery,
      signalStrength,
      receivedAt: new Date(),
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

  private findDuplicatedEvent(eventId: string) {
    return (this.prisma as any).sensorRecord.findUnique({ where: { eventId } });
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
    error: unknown,
    eventId?: string,
    originalSource?: string
  ) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    return this.deadLetterService
      .create({
        eventType,
        deviceName,
        thingsboardDeviceId,
        rawPayload: payload,
        eventId,
        originalSource,
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
