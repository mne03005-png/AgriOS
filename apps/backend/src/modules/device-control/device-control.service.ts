import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DeviceControlCommandDto } from './dto/device-control-command.dto';
import { MockDeviceController } from './adapters/mock-device-controller';
import { MqttDeviceController } from './adapters/mqtt-device-controller';
import { ThingsboardDeviceController } from './adapters/thingsboard-device-controller';
import { EdgeHttpDeviceController } from './adapters/edge-http-device-controller';
import { PlcGatewayDeviceController } from './adapters/plc-gateway-device-controller';
import { BluetoothLocalDeviceController } from './adapters/bluetooth-local-device-controller';
import { DeviceControlMode, normalizeDeviceControlMode } from './device-control-mode';

type AdapterAlias = 'mock' | 'mqtt' | 'thingsboard' | 'edge' | 'plc' | 'bluetooth';

@Injectable()
export class DeviceControlService {
  constructor(
    private readonly mockController: MockDeviceController,
    private readonly mqttController: MqttDeviceController,
    private readonly thingsboardController: ThingsboardDeviceController,
    private readonly edgeController: EdgeHttpDeviceController,
    private readonly plcController: PlcGatewayDeviceController,
    private readonly bluetoothController: BluetoothLocalDeviceController,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async send(deviceId: string, dto: DeviceControlCommandDto & { adapter?: AdapterAlias | DeviceControlMode; controlPath?: 'ACTION_QUEUE'; commandId?: string }) {
    this.validatePayload(dto);
    const mode = this.resolveMode(dto.adapter);
    if (this.isReadOnlyControlMode(mode)) {
      const result = {
        ok: false,
        code: 'READ_ONLY_MODE',
        reason: 'Device control is disabled. Telemetry access is read-only.',
        mode,
        deviceId,
        command: dto.command
      };
      await this.recordAttempt(deviceId, dto.command, mode, result);
      return result;
    }
    if (dto.controlPath !== 'ACTION_QUEUE' || !dto.commandId) {
      throw new BadRequestException('Physical commands must enter through Safety, Approval, ActionPlan and ActionQueue');
    }
    const controller = this.controllerForMode(mode);
    const payload = { remark: dto.remark, ...(dto.payload ?? {}), controlPath: dto.controlPath, commandId: dto.commandId, idempotencyKey: dto.commandId };
    const result = await this.dispatch(controller, deviceId, dto.command, payload);
    await this.recordAttempt(deviceId, dto.command, mode, result);
    this.eventBus.publish('device.command.sent', { deviceId, command: dto.command, mode, result });
    return result;
  }

  startIrrigation(deviceId: string, remark?: string) {
    return this.send(deviceId, { command: 'PUMP_ON', remark });
  }

  stopIrrigation(deviceId: string, remark?: string) {
    return this.send(deviceId, { command: 'PUMP_OFF', remark });
  }

  setValveOpening(deviceId: string, openingPercent: number, remark?: string) {
    return this.send(deviceId, { command: 'SET_VALVE_OPENING', remark, payload: { openingPercent } });
  }

  setPumpFrequency(deviceId: string, frequencyHz: number, remark?: string) {
    return this.send(deviceId, { command: 'SET_PUMP_FREQUENCY', remark, payload: { frequencyHz } });
  }

  startFertigation(deviceId: string, payload: Record<string, unknown> = {}) {
    return this.send(deviceId, { command: 'START_FERTIGATION', payload });
  }

  stopFertigation(deviceId: string, remark?: string) {
    return this.send(deviceId, { command: 'STOP_FERTIGATION', remark });
  }

  startDissolving(deviceId: string, payload: Record<string, unknown> = {}) {
    return this.send(deviceId, { command: 'START_DISSOLVING', payload });
  }

  stopDissolving(deviceId: string, remark?: string) {
    return this.send(deviceId, { command: 'STOP_DISSOLVING', remark });
  }

  status() {
    const mode = normalizeDeviceControlMode(this.config.get<string>('DEVICE_CONTROL_MODE'));
    return {
      mode,
      readOnly: this.isReadOnlyControlMode(mode),
      enableAutoExecution: (this.config.get<string>('ENABLE_AUTO_EXECUTION') ?? 'false').toLowerCase() === 'true',
      bluetoothLocalEnabled: (this.config.get<string>('ENABLE_BLUETOOTH_LOCAL') ?? 'false').toLowerCase() === 'true',
      message: 'ThingsBoard is the device room; AgriOS is the agricultural cockpit.'
    };
  }

  private resolveMode(adapter?: AdapterAlias | DeviceControlMode) {
    const map: Record<string, DeviceControlMode> = {
      mock: 'MOCK',
      mqtt: 'MQTT_DIRECT',
      thingsboard: 'THINGSBOARD_CLOUD',
      edge: 'EDGE_HTTP',
      plc: 'PLC_GATEWAY',
      bluetooth: 'BLUETOOTH_LOCAL'
    };
    return adapter ? map[String(adapter)] ?? normalizeDeviceControlMode(String(adapter)) : normalizeDeviceControlMode(this.config.get<string>('DEVICE_CONTROL_MODE'));
  }

  private controllerForMode(mode: DeviceControlMode) {
    if (mode === 'THINGSBOARD_CLOUD') return this.thingsboardController;
    if (mode === 'MQTT_DIRECT') return this.mqttController;
    if (mode === 'EDGE_HTTP') return this.edgeController;
    if (mode === 'PLC_GATEWAY') return this.plcController;
    if (mode === 'BLUETOOTH_LOCAL') return this.bluetoothController;
    return this.mockController;
  }

  private isReadOnlyControlMode(mode: DeviceControlMode) {
    const dryRun = (this.config.get<string>('DEVICE_CONTROL_DRY_RUN') ?? 'true').toLowerCase() === 'true';
    const allowRealValve = (this.config.get<string>('VALVE_ALLOW_REAL_CONTROL') ?? 'false').toLowerCase() === 'true';
    const autoExecution = (this.config.get<string>('ENABLE_AUTO_EXECUTION') ?? 'false').toLowerCase() === 'true';
    return mode === 'MOCK' || dryRun || !allowRealValve || !autoExecution;
  }

  private dispatch(controller: any, deviceId: string, command: string, payload: Record<string, unknown>) {
    const handlers: Record<string, () => Promise<unknown>> = {
      VALVE_OPEN: () => controller.openValve(deviceId, payload),
      VALVE_CLOSE: () => controller.closeValve(deviceId, payload),
      TEST_OPEN_VALVE: () => (controller.testOpenValve ? controller.testOpenValve(deviceId, payload) : controller.openValve(deviceId, payload)),
      PUMP_ON: () => (controller.startPump ? controller.startPump(deviceId, payload) : controller.startIrrigation(deviceId, payload)),
      PUMP_OFF: () => (controller.stopPump ? controller.stopPump(deviceId, payload) : controller.stopIrrigation(deviceId, payload)),
      SET_VALVE_OPENING: () => controller.setValveOpening(deviceId, payload),
      SET_PUMP_FREQUENCY: () => controller.setPumpFrequency(deviceId, payload),
      START_FERTIGATION: () => controller.startFertigation(deviceId, payload),
      STOP_FERTIGATION: () => controller.stopFertigation(deviceId, payload),
      START_DISSOLVING: () => controller.startDissolving(deviceId, payload),
      STOP_DISSOLVING: () => controller.stopDissolving(deviceId, payload),
      EMERGENCY_STOP: () => (controller.emergencyStop ? controller.emergencyStop(deviceId, payload) : controller.stopIrrigation(deviceId, payload))
    };
    if (!handlers[command]) throw new BadRequestException(`Unsupported device command: ${command}`);
    return handlers[command]();
  }

  private async recordAttempt(deviceId: string, command: string, mode: DeviceControlMode, result: unknown) {
    const ok = typeof result === 'object' && result && 'ok' in result ? Boolean((result as { ok?: unknown }).ok) : true;
    await (this.prisma as any).eventLog.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        userId: this.requestContext.getUserId(),
        requestId: this.requestContext.getRequestId(),
        eventType: ok ? 'device.control.attempt' : 'device.control.failed',
        severity: ok ? 'INFO' : 'WARNING',
        entityType: 'Device',
        entityId: deviceId,
        payload: { command, mode, result } as any
      }
    });
    if (!ok) {
      await this.audit.record({
        eventType: 'device_control_failed',
        severity: 'WARNING',
        entityType: 'Device',
        entityId: deviceId,
        payload: { command, mode, result }
      });
    }
  }

  private validatePayload(dto: DeviceControlCommandDto) {
    const payload = dto.payload ?? {};
    const openingPercent = Number(payload.openingPercent);
    const frequencyHz = Number(payload.frequencyHz);
    const durationMinutes = Number(payload.durationMinutes ?? payload.duration);
    const fertilizerVolume = Number(payload.targetFertilizerVolume ?? payload.fertilizerVolume);
    const tankLevel = Number(payload.fertilizerTankLevelL ?? payload.tankLevelL);
    if (dto.command === 'SET_VALVE_OPENING' && (!Number.isFinite(openingPercent) || openingPercent < 0 || openingPercent > 100)) {
      throw new BadRequestException('Valve opening percent must be between 0 and 100');
    }
    if (dto.command === 'SET_PUMP_FREQUENCY' && (!Number.isFinite(frequencyHz) || frequencyHz < 0 || frequencyHz > 60)) {
      throw new BadRequestException('Pump frequency must be between 0 and 60 Hz');
    }
    if (['START_FERTIGATION', 'START_DISSOLVING', 'PUMP_ON', 'VALVE_OPEN'].includes(dto.command) && Number.isFinite(durationMinutes) && (durationMinutes < 1 || durationMinutes > 720)) {
      throw new BadRequestException('Duration must be between 1 and 720 minutes');
    }
    if (Number.isFinite(fertilizerVolume) && Number.isFinite(tankLevel) && fertilizerVolume > tankLevel) {
      throw new BadRequestException('Fertilizer volume cannot exceed tank level');
    }
  }
}
