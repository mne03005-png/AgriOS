import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  live() {
    return { ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  async ready() {
    const database = await this.checkDatabase();
    const redisUrl = this.config.get<string>('REDIS_URL');
    const control = this.deviceControlReadiness();
    const valve = await this.valveReadiness();
    return {
      ok: database.ok && control.deviceControlModeReady,
      database,
      redis: redisUrl ? { configured: true, status: 'not_checked' } : { configured: false, status: 'optional' },
      actionQueue: {
        driver: this.config.get<string>('ACTION_QUEUE_DRIVER') ?? 'memory',
        fallback: !redisUrl || this.config.get<string>('ACTION_QUEUE_DRIVER') !== 'bullmq'
      },
      ...control,
      ...valve,
      enableAutoExecution: (this.config.get<string>('ENABLE_AUTO_EXECUTION') ?? 'false').toLowerCase() === 'true',
      safeDefault: (this.config.get<string>('ENABLE_AUTO_EXECUTION') ?? 'false').toLowerCase() !== 'true',
      demoHealth: { endpoint: '/api/v1/demo/health?farmId=demo' }
    };
  }

  modules() {
    return {
      iot: 'ready',
      decisionEngine: 'ready',
      gis: 'ready',
      irrigationDesign: 'ready',
      rotation: 'ready',
      fertigation: 'ready',
      droneOperation: 'ready',
      mobile: 'ready',
      billing: 'ready',
      actionQueue: this.config.get<string>('ACTION_QUEUE_DRIVER') ?? 'memory',
      deviceControl: this.deviceControlReadiness(),
      valveControl: this.valveReadinessSync()
    };
  }

  async metrics() {
    const [pending, running, failed, deviceCount, farmCount, eventLogCount, auditErrorCount, valvePendingCommands, valveFailedCommands, valveTimeoutCommands, valveLastAck] = await Promise.all([
      (this.prisma as any).actionQueueJob.count({ where: { status: { in: ['PENDING', 'QUEUED', 'RETRYING'] } } }),
      (this.prisma as any).actionQueueJob.count({ where: { status: 'EXECUTING' } }),
      (this.prisma as any).actionQueueJob.count({ where: { status: { in: ['FAILED', 'DEAD_LETTERED'] } } }),
      this.prisma.device.count(),
      this.prisma.farm.count(),
      (this.prisma as any).eventLog.count(),
      (this.prisma as any).auditEvent.count({ where: { severity: { in: ['ERROR', 'CRITICAL'] } } }),
      (this.prisma as any).deviceCommand.count({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, status: { in: ['PENDING', 'SENT'] } } }),
      (this.prisma as any).deviceCommand.count({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, status: 'FAILED' } }),
      (this.prisma as any).deviceCommand.count({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, status: 'TIMEOUT' } }),
      (this.prisma as any).deviceCommand.findFirst({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, ackAt: { not: null } }, orderBy: { ackAt: 'desc' } })
    ]);
    return {
      actionQueue: { pending, running, failed },
      valvePendingCommands,
      valveFailedCommands,
      valveTimeoutCommands,
      valveLastAckAt: valveLastAck?.ackAt ?? null,
      deviceCount,
      farmCount,
      eventLogLastCount: eventLogCount,
      errorCount: auditErrorCount
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private deviceControlReadiness() {
    const mode = this.config.get<string>('DEVICE_CONTROL_MODE') ?? 'MOCK';
    const normalizedMode = mode === 'THINGSBOARD' ? 'THINGSBOARD_CLOUD' : mode === 'MQTT' ? 'MQTT_DIRECT' : mode;
    const thingsBoardConfigured = Boolean((this.config.get<string>('THINGSBOARD_BASE_URL') ?? this.config.get<string>('THINGSBOARD_URL')) && this.config.get<string>('THINGSBOARD_TOKEN'));
    const mqttDirectConfigured = Boolean(this.config.get<string>('MQTT_BROKER_URL'));
    const edgeControllerConfigured = Boolean(this.config.get<string>('EDGE_CONTROLLER_BASE_URL') && this.config.get<string>('EDGE_CONTROLLER_TOKEN'));
    const plcGatewayConfigured = Boolean(this.config.get<string>('PLC_GATEWAY_BASE_URL') && this.config.get<string>('PLC_GATEWAY_TOKEN'));
    const bluetoothLocalEnabled = (this.config.get<string>('ENABLE_BLUETOOTH_LOCAL') ?? 'false').toLowerCase() === 'true';
    const productionWarnings: string[] = [];
    let ready = true;

    if (this.config.get<string>('NODE_ENV') === 'production' && normalizedMode === 'MOCK') {
      productionWarnings.push('production + DEVICE_CONTROL_MODE=MOCK is safe for demo but not production execution');
    }
    if (normalizedMode === 'THINGSBOARD_CLOUD' && !thingsBoardConfigured) ready = false;
    if (normalizedMode === 'MQTT_DIRECT' && !mqttDirectConfigured) ready = false;
    if (normalizedMode === 'EDGE_HTTP' && !edgeControllerConfigured) ready = false;
    if (normalizedMode === 'PLC_GATEWAY' && !plcGatewayConfigured) ready = false;
    if (normalizedMode === 'BLUETOOTH_LOCAL' && !bluetoothLocalEnabled) ready = false;

    return {
      deviceControlMode: normalizedMode,
      deviceControlModeReady: ready,
      thingsBoardConfigured,
      mqttDirectConfigured,
      edgeControllerConfigured,
      plcGatewayConfigured,
      bluetoothLocalEnabled,
      productionWarnings
    };
  }

  private async valveReadiness() {
    const [valvePendingCommands, valveFailedCommands, valveTimeoutCommands, valveLastAck] = await Promise.all([
      (this.prisma as any).deviceCommand.count({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, status: { in: ['PENDING', 'SENT'] } } }),
      (this.prisma as any).deviceCommand.count({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, status: 'FAILED' } }),
      (this.prisma as any).deviceCommand.count({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, status: 'TIMEOUT' } }),
      (this.prisma as any).deviceCommand.findFirst({ where: { command: { in: ['OPEN', 'CLOSE', 'SET_OPENING', 'TEST_OPEN'] }, ackAt: { not: null } }, orderBy: { ackAt: 'desc' } })
    ]);
    return {
      ...this.valveReadinessSync(),
      valvePendingCommands,
      valveFailedCommands,
      valveTimeoutCommands,
      valveLastAckAt: valveLastAck?.ackAt ?? null
    };
  }

  private valveReadinessSync() {
    return {
      valveDryRun: (this.config.get<string>('DEVICE_CONTROL_DRY_RUN') ?? 'true').toLowerCase() !== 'false',
      valveRealControlAllowed: (this.config.get<string>('VALVE_ALLOW_REAL_CONTROL') ?? 'false').toLowerCase() === 'true',
      valveFeedbackRequired: (this.config.get<string>('VALVE_REQUIRE_FEEDBACK') ?? 'true').toLowerCase() !== 'false',
      valveCommandTimeoutMs: Number(this.config.get<string>('VALVE_COMMAND_TIMEOUT_MS') ?? 10000)
    };
  }
}
