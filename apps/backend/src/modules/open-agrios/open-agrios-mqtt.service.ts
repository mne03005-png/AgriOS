import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEVICE_OFFLINE_AFTER_MS,
  LOW_BATTERY_THRESHOLD,
  LOW_SOIL_MOISTURE_THRESHOLD,
  OPEN_AGRIOS_MQTT_TOPIC_WILDCARD,
  OPEN_AGRIOS_TELEMETRY_TOPIC_PATTERN,
  OpenAgriosTelemetryPayload
} from './open-agrios.constants';

// Read-only telemetry ingestion for the OpenAgriOS v0.1-alpha demo pipeline:
//   Sensor Simulator -> MQTT Broker -> this service -> SensorRecord / Device / SafetyAlert
//
// Deliberately independent of src/modules/mqtt/mqtt.service.ts, which carries the production
// device-command path and only connects when DEVICE_CONTROL_MODE=MQTT_DIRECT. This service never
// publishes a command and connects whenever OPEN_AGRIOS_MQTT_ENABLED is not explicitly disabled,
// so the alpha demo works out of the box.
@Injectable()
export class OpenAgriosMqttService implements OnModuleInit, OnModuleDestroy {
  static connectFactory = mqtt.connect;

  private readonly logger = new Logger(OpenAgriosMqttService.name);
  private client?: MqttClient;
  private offlineCheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<string>('OPEN_AGRIOS_MQTT_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log('OpenAgriOS MQTT ingestion disabled (OPEN_AGRIOS_MQTT_ENABLED=false)');
      return;
    }

    const brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') ?? 'mqtt://localhost:1883';
    const clientId = this.configService.get<string>('OPEN_AGRIOS_MQTT_CLIENT_ID') ?? `openagrios-backend-${Date.now()}`;

    this.client = OpenAgriosMqttService.connectFactory(brokerUrl, { clientId });
    this.client.on('connect', () => {
      this.logger.log(`OpenAgriOS telemetry connected to MQTT broker: ${brokerUrl}`);
      this.client?.subscribe(OPEN_AGRIOS_MQTT_TOPIC_WILDCARD);
    });
    this.client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload.toString());
    });
    this.client.on('error', (error) => {
      this.logger.error(`OpenAgriOS MQTT error: ${error.message}`);
    });

    this.offlineCheckTimer = setInterval(() => void this.markStaleDevicesOffline(), 15_000);
  }

  onModuleDestroy() {
    this.client?.end();
    if (this.offlineCheckTimer) clearInterval(this.offlineCheckTimer);
  }

  private async handleMessage(topic: string, raw: string) {
    const match = topic.match(OPEN_AGRIOS_TELEMETRY_TOPIC_PATTERN);
    if (!match) return;
    const [, farmId, topicDeviceId] = match;

    const payload = this.parsePayload(raw);
    if (!payload) {
      this.logger.warn(`OpenAgriOS telemetry payload rejected (invalid JSON) on ${topic}`);
      return;
    }

    const validation = this.validate(payload, topicDeviceId);
    if (!validation.ok) {
      this.logger.warn(`OpenAgriOS telemetry payload rejected on ${topic}: ${validation.reason}`);
      return;
    }

    await this.ingest(farmId, payload);
  }

  private parsePayload(raw: string): OpenAgriosTelemetryPayload | null {
    try {
      return JSON.parse(raw) as OpenAgriosTelemetryPayload;
    } catch {
      return null;
    }
  }

  // Basic data validation, per the alpha scope -- reject malformed messages rather than crash or
  // silently store garbage. Not a full schema validator; matches the "do not over-engineer" scope.
  private validate(payload: OpenAgriosTelemetryPayload, topicDeviceId: string): { ok: true } | { ok: false; reason: string } {
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'payload is not an object' };
    if (typeof payload.deviceId !== 'string' || !payload.deviceId.trim()) return { ok: false, reason: 'missing deviceId' };
    if (payload.deviceId !== topicDeviceId) return { ok: false, reason: `deviceId mismatch: topic=${topicDeviceId} payload=${payload.deviceId}` };
    if (!payload.data || typeof payload.data !== 'object') return { ok: false, reason: 'missing data object' };
    const numericFields: Array<keyof OpenAgriosTelemetryPayload['data']> = ['soilMoisture', 'temperature', 'humidity', 'battery'];
    const hasAnyMetric = numericFields.some((key) => typeof payload.data[key] === 'number' && Number.isFinite(payload.data[key]));
    if (!hasAnyMetric) return { ok: false, reason: 'data object has no numeric metrics' };
    return { ok: true };
  }

  private async ingest(farmId: string, payload: OpenAgriosTelemetryPayload) {
    const reportedAt = payload.timestamp && !Number.isNaN(Date.parse(payload.timestamp)) ? new Date(payload.timestamp) : new Date();

    const device = await this.prisma.device.upsert({
      where: { code: payload.deviceId },
      update: {
        online: payload.status !== 'offline',
        lastTelemetryAt: reportedAt,
        lastReportedAt: reportedAt,
        currentStatus: payload.data as any,
        ...(payload.fieldId ? { fieldId: payload.fieldId } : {})
      },
      create: {
        code: payload.deviceId,
        name: payload.deviceId,
        type: 'SOIL_SENSOR',
        fieldId: payload.fieldId,
        online: payload.status !== 'offline',
        lastTelemetryAt: reportedAt,
        lastReportedAt: reportedAt,
        currentStatus: payload.data as any
      }
    });

    const primaryType = typeof payload.data.soilMoisture === 'number' ? 'SOIL_MOISTURE' : typeof payload.data.temperature === 'number' ? 'TEMPERATURE' : 'HUMIDITY';
    const primaryValue = payload.data.soilMoisture ?? payload.data.temperature ?? payload.data.humidity ?? 0;

    await this.prisma.sensorRecord.create({
      data: {
        deviceId: device.id,
        fieldId: device.fieldId ?? payload.fieldId,
        farmId,
        deviceName: device.name,
        type: primaryType as any,
        value: primaryValue,
        soilMoisture: payload.data.soilMoisture,
        temperature: payload.data.temperature,
        humidity: payload.data.humidity,
        battery: payload.data.battery,
        rawPayload: payload as any,
        reportedAt
      } as any
    });

    await this.evaluateAlerts(farmId, device.id, device.fieldId ?? payload.fieldId ?? null, payload.data);
  }

  private async evaluateAlerts(farmId: string, deviceId: string, fieldId: string | null, data: OpenAgriosTelemetryPayload['data']) {
    if (typeof data.soilMoisture === 'number' && data.soilMoisture < LOW_SOIL_MOISTURE_THRESHOLD) {
      await this.raiseAlertOnce(farmId, fieldId, deviceId, 'LOW_SOIL_MOISTURE', 'MEDIUM', `Soil moisture ${data.soilMoisture}% is below the ${LOW_SOIL_MOISTURE_THRESHOLD}% alpha threshold.`);
    }
    if (typeof data.battery === 'number' && data.battery < LOW_BATTERY_THRESHOLD) {
      await this.raiseAlertOnce(farmId, fieldId, deviceId, 'LOW_BATTERY', 'MEDIUM', `Device battery ${data.battery}% is below the ${LOW_BATTERY_THRESHOLD}% alpha threshold.`);
    }
  }

  private async raiseAlertOnce(farmId: string, fieldId: string | null, deviceId: string, alertType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', message: string) {
    const existingOpen = await (this.prisma as any).safetyAlert.findFirst({
      where: { farmId, alertType, status: 'OPEN', metadata: { path: ['deviceId'], equals: deviceId } }
    });
    if (existingOpen) return;

    await (this.prisma as any).safetyAlert.create({
      data: {
        farmId,
        fieldId: fieldId ?? undefined,
        alertType,
        severity,
        message,
        status: 'OPEN',
        metadata: { deviceId, source: 'OPEN_AGRIOS_ALPHA' }
      }
    });
  }

  private async markStaleDevicesOffline() {
    // Device has no direct farmId column -- it is only reachable through the bound Field, so an
    // unbound device is marked offline but cannot raise a farm-scoped alert.
    const cutoff = new Date(Date.now() - DEVICE_OFFLINE_AFTER_MS);
    const staleDevices = await this.prisma.device.findMany({
      where: { online: true, lastTelemetryAt: { lt: cutoff } },
      select: { id: true, fieldId: true, field: { select: { farmId: true } } }
    });
    if (!staleDevices.length) return;

    await this.prisma.device.updateMany({
      where: { id: { in: staleDevices.map((item) => item.id) } },
      data: { online: false }
    });

    for (const device of staleDevices) {
      if (!device.field?.farmId) continue;
      await this.raiseAlertOnce(device.field.farmId, device.fieldId, device.id, 'DEVICE_OFFLINE', 'LOW', `Device stopped reporting telemetry for more than ${DEVICE_OFFLINE_AFTER_MS / 1000}s.`);
    }
  }
}
