import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { PrismaService } from '../../prisma/prisma.service';
import { IrrigationRuleService } from '../irrigation-rule/irrigation-rule.service';
import { DeviceCommandDto } from './dto/device-command.dto';
import { MQTT_TOPICS } from './mqtt-topics';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly irrigationRuleService: IrrigationRuleService
  ) {}

  onModuleInit() {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') ?? 'mqtt://localhost:1883';
    const clientId = this.configService.get<string>('MQTT_CLIENT_ID') ?? 'agrios-backend';

    this.client = mqtt.connect(brokerUrl, { clientId });
    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
      this.client?.subscribe([MQTT_TOPICS.telemetryWildcard, MQTT_TOPICS.statusWildcard, MQTT_TOPICS.ackWildcard]);
    });

    this.client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload.toString());
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });
  }

  onModuleDestroy() {
    this.client?.end();
  }

  publishCommand(dto: DeviceCommandDto) {
    const topic = MQTT_TOPICS.command(dto.deviceId);
    const message = JSON.stringify({
      command: dto.command,
      requestId: dto.requestId,
      ...(dto.payload ?? {})
    });
    this.client?.publish(topic, message);
    return { topic, message };
  }

  private async handleMessage(topic: string, payload: string) {
    this.logger.debug(`MQTT message ${topic}: ${payload}`);
    const match = topic.match(/^agrios\/device\/([^/]+)\/(telemetry|status|ack)$/);
    if (!match) {
      return;
    }

    const [, deviceCode, messageType] = match;
    const data = this.parsePayload(payload);
    if (!data) {
      return;
    }

    const device = await this.prisma.device.findUnique({ where: { code: deviceCode } });
    if (!device) {
      this.logger.warn(`MQTT message ignored. Unknown device code: ${deviceCode}`);
      return;
    }

    if (messageType === 'ack') {
      await this.handleAck(device.id, data);
      return;
    }

    if (messageType === 'status') {
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          online: Boolean(data.online),
          currentStatus: data as any,
          lastReportedAt: new Date()
        }
      });
      return;
    }

    if (messageType === 'telemetry' && device.fieldId) {
      await this.writeTelemetryRecords(device.id, device.fieldId, data);
    }
  }

  private parsePayload(payload: string) {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      this.logger.warn(`Invalid MQTT JSON payload: ${payload}`);
      return null;
    }
  }

  private async writeTelemetryRecords(deviceId: string, fieldId: string, data: Record<string, unknown>) {
    const reportedAt = typeof data.timestamp === 'string' ? new Date(data.timestamp) : new Date();
    const candidates = [
      { key: 'soilMoisture', type: 'SOIL_MOISTURE', unit: '%' },
      { key: 'temperature', type: 'TEMPERATURE', unit: 'C' },
      { key: 'humidity', type: 'HUMIDITY', unit: '%' },
      { key: 'flow', type: 'FLOW', unit: 'm3/h' },
      { key: 'waterLevel', type: 'WATER_LEVEL', unit: 'cm' }
    ] as const;

    const records = candidates
      .filter((item) => typeof data[item.key] === 'number')
      .map((item) => ({
        deviceId,
        fieldId,
        type: item.type,
        value: data[item.key] as number,
        unit: item.unit,
        reportedAt
      }));

    if (records.length > 0) {
      await this.prisma.sensorRecord.createMany({ data: records });
    }

    if (typeof data.soilMoisture === 'number') {
      const advice = this.irrigationRuleService.evaluate({ fieldId, soilMoisture: data.soilMoisture });
      if (advice.action === 'SHOULD_IRRIGATE' || advice.action === 'STOP_IRRIGATION') {
        const currentCropSeason = await this.prisma.cropSeason.findFirst({
          where: { fieldId, status: { in: ['PLANNED', 'GROWING'] } },
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
        });
        await this.prisma.irrigationAdvice.create({
          data: {
            fieldId,
            deviceId,
            cropSeasonId: currentCropSeason?.id,
            soilMoisture: data.soilMoisture,
            action: advice.action,
            message: advice.message,
            source: 'MQTT'
          }
        });
        this.logger.warn(`Irrigation advice saved for field ${fieldId}: ${advice.message}. Manual confirmation is required.`);
      } else {
        this.logger.log(`Irrigation rule evaluated for field ${fieldId}: ${advice.action}`);
      }
    }

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        online: true,
        currentStatus: data as any,
        lastReportedAt: reportedAt
      }
    });

    // TODO: persist irrigation advice logs after an advice/audit table is introduced.
    // V1 keeps this as system advice and does not automatically turn on the pump.
  }

  private async handleAck(deviceId: string, data: Record<string, unknown>) {
    if (typeof data.requestId !== 'string') {
      this.logger.warn('MQTT ack ignored. Missing requestId.');
      return;
    }
    const status = data.status === 'FAILED' ? 'FAILED' : 'ACKED';
    await (this.prisma as any).deviceCommand.updateMany({
      where: { deviceId, requestId: data.requestId },
      data: {
        status,
        ackAt: new Date(),
        errorMessage: typeof data.message === 'string' ? data.message : undefined
      }
    });
    await this.prisma.operationLog.create({
      data: {
        action: 'DEVICE_COMMAND_ACK',
        targetType: 'DEVICE',
        targetId: deviceId,
        description: '收到设备命令回执',
        metadata: { requestId: data.requestId, status, message: typeof data.message === 'string' ? data.message : undefined } as any
      }
    });
  }
}
