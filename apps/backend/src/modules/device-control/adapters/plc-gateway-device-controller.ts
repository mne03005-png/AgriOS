import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceControlPayload } from '../device-controller.interface';
import { PlcCommandResult, PlcControlCommand, PlcControllerPort, PlcFeedback, PlcStatus } from '../plc-control.types';
import { ModbusTcpTransport } from '../transports/modbus-tcp.transport';

type PlcProfile = {
  unitId: number | null;
  registers?: Record<string, number | null>;
  points?: Record<string, { type: string; address: number | null; scale?: number | null }>;
};

@Injectable()
export class PlcGatewayDeviceController implements PlcControllerPort {
  private readonly results = new Map<string, PlcCommandResult>();
  private status: PlcStatus = { online: false, emergencyStop: false, noWater: false, pumpRunning: false, valveOpen: false };

  constructor(private readonly config: ConfigService, @Optional() private readonly modbusTransport?: ModbusTcpTransport) {}

  async execute(command: PlcControlCommand): Promise<PlcCommandResult> {
    const previous = this.results.get(command.commandId);
    if (previous) return previous;
    if (Date.parse(command.expiresAt) <= Date.now()) return this.remember(command, this.rejected(command, 'EXPIRED', 'COMMAND_EXPIRED'));
    if (!command.commandId || command.commandId !== command.idempotencyKey) return this.remember(command, this.rejected(command, 'REJECTED', 'INVALID_IDEMPOTENCY_KEY'));
    if (!this.realExecutionEnabled()) return this.remember(command, this.rejected(command, 'SAFETY_BLOCKED', 'REAL_CONTROL_DISABLED'));
    if (!this.profileConfigured()) return this.remember(command, this.rejected(command, 'REJECTED', 'PLC_PROFILE_UNCONFIGURED'));
    if (!this.status.online) return this.remember(command, this.rejected(command, 'REJECTED', 'CONTROLLER_OFFLINE'));
    if (command.action === 'PUMP_ON' && (this.status.emergencyStop || this.status.noWater || !this.status.valveOpen)) {
      return this.remember(command, this.rejected(command, 'SAFETY_BLOCKED', 'PUMP_INTERLOCK_BLOCKED'));
    }
    if (command.action === 'VALVE_CLOSE' && this.status.pumpRunning) {
      return this.remember(command, this.rejected(command, 'SAFETY_BLOCKED', 'STOP_PUMP_BEFORE_VALVE_CLOSE'));
    }
    if (this.config.get<string>('NODE_ENV') === 'test' && this.config.get<string>('PLC_GATEWAY_FAKE_TRANSPORT') === 'true') {
      if (command.parameters.simulate === 'timeout') return this.remember(command, this.rejected(command, 'TIMEOUT', 'ACK_TIMEOUT'));
      if (command.parameters.simulate === 'feedback-mismatch') return this.remember(command, this.rejected(command, 'FAILED', 'FEEDBACK_MISMATCH'));
      if (command.action === 'VALVE_OPEN') this.status.valveOpen = true;
      if (command.action === 'PUMP_ON') this.status.pumpRunning = true;
      if (command.action === 'PUMP_OFF') this.status.pumpRunning = false;
      if (command.action === 'VALVE_CLOSE') this.status.valveOpen = false;
      if (command.action === 'EMERGENCY_STOP') {
        this.status.emergencyStop = true;
        this.status.pumpRunning = false;
      }
      const now = new Date().toISOString();
      return this.remember(command, {
        commandId: command.commandId, accepted: true, executed: true, acknowledged: true,
        status: 'SUCCEEDED', startedAt: now, completedAt: now, feedback: { fake: true, ...this.status }
      });
    }
    if (this.config.get<string>('PLC_TRANSPORT') === 'MODBUS_TCP') {
      return this.remember(command, await this.executeModbus(command));
    }
    // Transport is intentionally absent until the commissioned profile and hardware protocol are approved.
    return this.remember(command, this.rejected(command, 'REJECTED', 'PLC_TRANSPORT_NOT_COMMISSIONED'));
  }

  emergencyStop(command: PlcControlCommand): Promise<PlcCommandResult>;
  emergencyStop(deviceId: string, payload?: DeviceControlPayload): Promise<PlcCommandResult> | object;
  emergencyStop(commandOrDeviceId: PlcControlCommand | string, payload?: DeviceControlPayload) {
    return typeof commandOrDeviceId === 'string'
      ? this.fromLegacy(commandOrDeviceId, 'EMERGENCY_STOP', payload)
      : this.execute({ ...commandOrDeviceId, action: 'EMERGENCY_STOP' });
  }
  async readStatus(_deviceId: string) { return { ...this.status }; }
  async healthCheck() {
    const transport = this.modbusTransport ? await this.modbusTransport.healthCheck() : undefined;
    return {
      healthy: this.status.online && this.profileConfigured() && (!transport || transport.connected),
      reason: !this.status.online ? 'CONTROLLER_OFFLINE' : !this.profileConfigured() ? 'PLC_PROFILE_UNCONFIGURED' : transport && !transport.connected ? 'PLC_TRANSPORT_OFFLINE' : undefined
    };
  }

  async verifyFeedback(command: PlcControlCommand, feedback: PlcFeedback): Promise<PlcCommandResult> {
    if (feedback.commandId !== command.commandId || feedback.tenantId !== command.tenantId || feedback.farmId !== command.farmId || feedback.deviceId !== command.deviceId) {
      return this.rejected(command, 'FAILED', 'FEEDBACK_IDENTITY_MISMATCH');
    }
    const result: PlcCommandResult = {
      commandId: command.commandId, accepted: true, executed: feedback.status === 'SUCCEEDED', acknowledged: true,
      status: feedback.status, completedAt: feedback.timestamp, feedback: feedback.feedback, errorCode: feedback.errorCode
    };
    this.results.set(command.commandId, result);
    return result;
  }

  openValve(deviceId: string, payload?: DeviceControlPayload) { return this.fromLegacy(deviceId, 'VALVE_OPEN', payload); }
  closeValve(deviceId: string, payload?: DeviceControlPayload) { return this.fromLegacy(deviceId, 'VALVE_CLOSE', payload); }
  startIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.fromLegacy(deviceId, 'PUMP_ON', payload); }
  stopIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.fromLegacy(deviceId, 'PUMP_OFF', payload); }
  setValveOpening(deviceId: string, payload?: DeviceControlPayload) { return this.unsupported(deviceId, 'SET_VALVE_OPENING', payload); }
  setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) { return this.unsupported(deviceId, 'SET_PUMP_FREQUENCY', payload); }
  startFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.unsupported(deviceId, 'START_FERTIGATION', payload); }
  stopFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.unsupported(deviceId, 'STOP_FERTIGATION', payload); }
  startDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.unsupported(deviceId, 'START_DISSOLVING', payload); }
  stopDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.unsupported(deviceId, 'STOP_DISSOLVING', payload); }
  getStatus(deviceId: string) { return this.readStatus(deviceId); }

  private fromLegacy(deviceId: string, action: PlcControlCommand['action'], payload?: DeviceControlPayload) {
    const value = (payload ?? {}) as Record<string, unknown>;
    if (value.controlPath !== 'ACTION_QUEUE' || typeof value.commandId !== 'string') return this.unsupported(deviceId, action, payload, 'ACTION_QUEUE_PATH_REQUIRED');
    return this.execute({
      commandId: value.commandId, idempotencyKey: String(value.idempotencyKey ?? value.commandId), tenantId: String(value.tenantId ?? ''),
      farmId: String(value.farmId ?? ''), fieldId: value.fieldId as string | undefined, zoneId: value.zoneId as string | undefined,
      deviceId, action, requestedAt: String(value.requestedAt ?? new Date().toISOString()), expiresAt: String(value.expiresAt ?? ''), parameters: value
    });
  }

  private realExecutionEnabled() {
    return this.config.get<string>('DEVICE_CONTROL_MODE') === 'PLC_GATEWAY'
      && this.config.get<string>('DEVICE_CONTROL_DRY_RUN') === 'false'
      && this.config.get<string>('VALVE_ALLOW_REAL_CONTROL') === 'true'
      && this.config.get<string>('ENABLE_AUTO_EXECUTION') === 'true';
  }
  private profileConfigured() {
    const profile = this.config.get<PlcProfile>('PLC_PROFILE');
    const addresses = profile?.points ? Object.values(profile.points).map((point) => point.address) : Object.values(profile?.registers ?? {});
    return Boolean(profile && Number.isInteger(profile.unitId) && addresses.length > 0 && addresses.every(Number.isInteger));
  }
  private async executeModbus(command: PlcControlCommand): Promise<PlcCommandResult> {
    if (!this.modbusTransport) return this.rejected(command, 'REJECTED', 'PLC_TRANSPORT_UNAVAILABLE');
    const logicalPoint: Partial<Record<PlcControlCommand['action'], string>> = {
      VALVE_OPEN: 'valveOpen', VALVE_CLOSE: 'valveClose', PUMP_ON: 'pumpStart', PUMP_OFF: 'pumpStop', EMERGENCY_STOP: 'pumpStop'
    };
    const pointName = logicalPoint[command.action];
    const profile = this.config.get<PlcProfile>('PLC_PROFILE');
    const point = pointName ? profile?.points?.[pointName] : undefined;
    if (!point || !Number.isInteger(point.address)) return this.rejected(command, 'REJECTED', 'PLC_POINT_UNCONFIRMED');
    const startedAt = new Date().toISOString();
    await this.modbusTransport.writeCoil(point.address as number, true);
    return {
      commandId: command.commandId, accepted: true, executed: true, acknowledged: false,
      status: 'ACK_PENDING', startedAt, feedback: { transport: 'MODBUS_TCP', logicalPoint: pointName }
    };
  }
  private rejected(command: Pick<PlcControlCommand, 'commandId'>, status: PlcCommandResult['status'], errorCode: string): PlcCommandResult {
    return { commandId: command.commandId, accepted: false, executed: false, acknowledged: false, status, errorCode, completedAt: new Date().toISOString() };
  }
  private remember(command: PlcControlCommand, result: PlcCommandResult) { this.results.set(command.commandId, result); return result; }
  private unsupported(deviceId: string, command: string, payload?: DeviceControlPayload, errorCode = 'PLC_COMMAND_UNSUPPORTED') {
    return { adapter: 'PLC_GATEWAY', deviceId, command, payload, ok: false, errorCode };
  }
}
