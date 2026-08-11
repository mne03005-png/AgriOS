import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceControlPayload } from '../device-controller.interface';
import { PlcCommandResult, PlcControlCommand, PlcControllerPort, PlcFeedback, PlcStatus } from '../plc-control.types';
import { ModbusTcpTransport } from '../transports/modbus-tcp.transport';
import { canonicalPlcLogicalName, evaluatePlcInterlock, expectedFeedbackLogicalName, findPlcMappingByLogicalName, isReadCapableMapping, isRealPlcWriteEnabled, isSupportedFeedbackMapping, isWriteCapableMapping } from '@agrios/edge-core';

type PlcProfile = {
  testOnly?: boolean;
  realHardwareApproved?: boolean;
  unitId: number | null;
  transport?: { unitId?: number | null };
  registers?: Record<string, number | null>;
  points?: Record<string, { type: string; address: number | null; scale?: number | null }>;
  mapping?: Array<{ logicalName: string; type?: string; functionCode: string; address: number | null; feedbackPoint?: string }>;
};

@Injectable()
export class PlcGatewayDeviceController implements PlcControllerPort {
  private readonly results = new Map<string, PlcCommandResult>();
  private status: PlcStatus = { online: false, emergencyStop: false, noWater: false, overloadTrip: false, pumpRunning: false, valveOpen: false, observedAt: new Date(0).toISOString(), source: 'MEMORY', fresh: false, stale: true };
  private readonly executionCounts = new Map<string, number>();

  constructor(private readonly config: ConfigService, @Optional() private readonly modbusTransport?: ModbusTcpTransport) {}

  async execute(command: PlcControlCommand): Promise<PlcCommandResult> {
    const invalidEnvelope = this.validateEnvelope(command);
    if (invalidEnvelope) return this.rejected(command, 'REJECTED', invalidEnvelope);
    const previous = this.results.get(command.commandId);
    if (previous) return previous;
    if (Date.parse(command.expiresAt) <= Date.now()) return this.remember(command, this.rejected(command, 'EXPIRED', 'COMMAND_EXPIRED'));
    if (!this.realExecutionEnabled()) return this.remember(command, this.rejected(command, 'SAFETY_BLOCKED', 'REAL_CONTROL_DISABLED'));
    if (!this.profileConfigured()) return this.remember(command, this.rejected(command, 'REJECTED', 'PLC_PROFILE_UNCONFIGURED'));
    const status = await this.readStatus(command.deviceId);
    if (!status.online) return this.remember(command, this.rejected(command, 'REJECTED', status.errorCode ?? 'CONTROLLER_OFFLINE'));
    if (this.requiresFreshStatus(command.action) && !status.fresh) return this.remember(command, this.rejected(command, 'SAFETY_BLOCKED', 'STALE_PLC_STATUS'));
    const interlock = evaluatePlcInterlock(command.action, status);
    if (!interlock.allowed) return this.remember(command, this.rejected(command, 'SAFETY_BLOCKED', interlock.errorCode));
    if (this.config.get<string>('NODE_ENV') === 'test' && this.config.get<string>('PLC_GATEWAY_FAKE_TRANSPORT') === 'true') {
      this.executionCounts.set(command.commandId, (this.executionCounts.get(command.commandId) ?? 0) + 1);
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
      this.status.observedAt = new Date().toISOString(); this.status.source = 'FAKE_FEEDBACK'; this.status.fresh = true; this.status.stale = false;
      const now = new Date().toISOString();
      return this.remember(command, {
        commandId: command.commandId, accepted: true, executed: true, acknowledged: true,
        status: 'SUCCEEDED', physicalConfirmed: true, transportAccepted: true, startedAt: now, completedAt: now, feedback: { fake: true, ...this.status }
      });
    }
    if (this.config.get<string>('PLC_TRANSPORT') === 'MODBUS_TCP') {
      return this.remember(command, await this.executeModbus(command));
    }
    // Transport is intentionally absent until the commissioned profile and hardware protocol are approved.
    return this.remember(command, this.rejected(command, 'REJECTED', 'PLC_TRANSPORT_NOT_COMMISSIONED'));
  }
  executionCount(commandId: string) { return this.executionCounts.get(commandId) ?? 0; }

  emergencyStop(command: PlcControlCommand): Promise<PlcCommandResult>;
  emergencyStop(deviceId: string, payload?: DeviceControlPayload): Promise<PlcCommandResult> | object;
  emergencyStop(commandOrDeviceId: PlcControlCommand | string, payload?: DeviceControlPayload) {
    return typeof commandOrDeviceId === 'string'
      ? this.fromLegacy(commandOrDeviceId, 'EMERGENCY_STOP', payload)
      : this.execute({ ...commandOrDeviceId, action: 'EMERGENCY_STOP' });
  }
  async readStatus(_deviceId: string): Promise<PlcStatus> {
    if (this.config.get<string>('NODE_ENV') === 'test' && this.config.get<string>('PLC_GATEWAY_FAKE_TRANSPORT') === 'true') {
      return { ...this.status, observedAt: new Date().toISOString(), source: 'FAKE_FEEDBACK', fresh: true, stale: false };
    }
    if (this.config.get<string>('PLC_TRANSPORT') !== 'MODBUS_TCP') return this.withFreshness({ ...this.status });
    if (!this.profileConfigured()) return this.unavailableStatus('PLC_PROFILE_UNCONFIRMED');
    if (!this.modbusTransport) return this.unavailableStatus('PLC_TRANSPORT_UNAVAILABLE');
    const profile = this.config.get<PlcProfile>('PLC_PROFILE');
    const required = ['emergencyStop', 'noWater', 'overloadTrip', 'pumpRunningFeedback', 'valveOpenFeedback'] as const;
    const points = required.map((name) => [name, this.feedbackPoint(profile, name)] as const);
    if (points.some(([, point]) => !point)) return this.unavailableStatus('FEEDBACK_UNAVAILABLE');
    try {
      const values: boolean[] = [];
      for (const [, point] of points) values.push(await this.readPoint(point!));
      const observedAt = new Date().toISOString();
      this.status = { online: true, emergencyStop: values[0], noWater: values[1], overloadTrip: values[2], pumpRunning: values[3], valveOpen: values[4], observedAt, source: 'MODBUS_TCP', fresh: true, stale: false };
      return { ...this.status };
    } catch {
      return this.unavailableStatus('PLC_STATUS_READ_FAILED');
    }
  }
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
    const evidence = feedback.feedback ?? {};
    const observedAt = Date.parse(String(evidence.observedAt ?? ''));
    const sourceAllowed = evidence.source === 'MODBUS_TCP' || (evidence.source === 'FAKE_FEEDBACK' && this.config.get<string>('NODE_ENV') === 'test');
    const physicalConfirmed = feedback.status === 'SUCCEEDED' && evidence.physicalConfirmed === true && sourceAllowed && Number.isFinite(observedAt)
      && evidence.expectedState !== undefined && evidence.expectedState === evidence.observedState;
    const failed = feedback.status === 'FAILED';
    const result: PlcCommandResult = {
      commandId: command.commandId, accepted: !failed, executed: physicalConfirmed, physicalConfirmed, transportAccepted: true, acknowledged: true,
      status: failed ? 'FAILED' : physicalConfirmed ? 'PHYSICALLY_CONFIRMED' : 'ACKNOWLEDGED', completedAt: physicalConfirmed || failed ? feedback.timestamp : undefined, feedback: evidence, errorCode: feedback.errorCode
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
    if (!['ACTION_QUEUE', 'SAFETY_DISPATCH'].includes(String(value.controlPath)) || typeof value.commandId !== 'string') return this.unsupported(deviceId, action, payload, 'AUTHORIZED_CONTROL_PATH_REQUIRED');
    return this.execute({
      commandId: value.commandId, idempotencyKey: String(value.idempotencyKey ?? value.commandId), tenantId: String(value.tenantId ?? ''),
      farmId: String(value.farmId ?? ''), fieldId: value.fieldId as string | undefined, zoneId: value.zoneId as string | undefined,
      deviceId, action, requestedAt: String(value.requestedAt ?? ''), expiresAt: String(value.expiresAt ?? ''), parameters: value
    });
  }

  private validateEnvelope(command: PlcControlCommand) {
    if (!command.commandId.trim() || command.commandId !== command.idempotencyKey) return 'INVALID_IDEMPOTENCY_KEY';
    if (!command.tenantId.trim()) return 'TENANT_ID_REQUIRED';
    if (!command.farmId.trim()) return 'FARM_ID_REQUIRED';
    if (!command.deviceId.trim()) return 'DEVICE_ID_REQUIRED';
    const requestedAt = Date.parse(command.requestedAt); const expiresAt = Date.parse(command.expiresAt);
    if (!Number.isFinite(requestedAt)) return 'REQUESTED_AT_INVALID';
    if (!Number.isFinite(expiresAt)) return 'EXPIRES_AT_INVALID';
    if (expiresAt > Date.now() && expiresAt <= requestedAt) return 'EXPIRY_WINDOW_INVALID';
    return undefined;
  }

  private realExecutionEnabled() {
    const fakeTest = this.config.get<string>('NODE_ENV') === 'test' && this.config.get<string>('PLC_GATEWAY_FAKE_TRANSPORT') === 'true';
    return fakeTest || isRealPlcWriteEnabled({
      deviceControlMode: this.config.get<string>('DEVICE_CONTROL_MODE'), deviceControlDryRun: this.config.get<string>('DEVICE_CONTROL_DRY_RUN'),
      valveAllowRealControl: this.config.get<string>('VALVE_ALLOW_REAL_CONTROL'), enableAutoExecution: this.config.get<string>('ENABLE_AUTO_EXECUTION'),
      plcTransport: this.config.get<string>('PLC_TRANSPORT'), plcRealWriteEnabled: this.config.get<string>('PLC_REAL_WRITE_ENABLED')
    });
  }
  private profileConfigured() {
    const profile = this.config.get<PlcProfile>('PLC_PROFILE');
    const addresses = profile?.mapping?.length ? profile.mapping.map((point) => point.address) : profile?.points ? Object.values(profile.points).map((point) => point.address) : Object.values(profile?.registers ?? {});
    const unitId = profile?.transport?.unitId ?? profile?.unitId;
    const configuredUnitId = Number(this.config.get<string>('PLC_MODBUS_UNIT_ID') ?? unitId);
    const testProfileAllowed = this.config.get<string>('NODE_ENV') === 'test' && profile?.testOnly === true;
    const mappingsValid = Array.isArray(profile?.mapping) && profile.mapping.length > 0 && profile.mapping.every((item) => {
      if (!Number.isInteger(item.address) || !item.logicalName?.trim() || !item.functionCode || item.functionCode === 'UNCONFIRMED') return false;
      if (!isWriteCapableMapping(item)) return true;
      const feedback = findPlcMappingByLogicalName(profile.mapping, String(item.feedbackPoint ?? ''));
      const expected = expectedFeedbackLogicalName(item.logicalName);
      return Boolean(feedback && feedback !== item && (!expected || canonicalPlcLogicalName(item.feedbackPoint) === expected) && isReadCapableMapping(feedback) && isSupportedFeedbackMapping(feedback) && Number.isInteger(feedback.address));
    });
    const approvedRealProfile = profile?.realHardwareApproved === true && mappingsValid;
    return Boolean(profile && Number.isInteger(unitId) && configuredUnitId === unitId && addresses.length > 0 && addresses.every(Number.isInteger) && (testProfileAllowed || approvedRealProfile || this.config.get<string>('PLC_TRANSPORT') !== 'MODBUS_TCP'));
  }
  private async executeModbus(command: PlcControlCommand): Promise<PlcCommandResult> {
    if (!this.modbusTransport) return this.rejected(command, 'REJECTED', 'PLC_TRANSPORT_UNAVAILABLE');
    const logicalPoint: Partial<Record<PlcControlCommand['action'], string>> = {
      VALVE_OPEN: 'valveOpen', VALVE_CLOSE: 'valveClose', PUMP_ON: 'pumpStart', PUMP_OFF: 'pumpStop', EMERGENCY_STOP: 'pumpStop'
    };
    const pointName = logicalPoint[command.action];
    const profile = this.config.get<PlcProfile>('PLC_PROFILE');
    const mappedPoint = pointName ? findPlcMappingByLogicalName(profile?.mapping, pointName) : undefined;
    const point = pointName ? profile?.points?.[pointName] ?? mappedPoint : undefined;
    if (!point || !Number.isInteger(point.address)) return this.rejected(command, 'REJECTED', 'PLC_POINT_UNCONFIRMED');
    const startedAt = new Date().toISOString();
    await this.modbusTransport.writeCoil(point.address as number, true);
    const pending: PlcCommandResult = {
      commandId: command.commandId, accepted: true, executed: false, physicalConfirmed: false, transportAccepted: true, acknowledged: false,
      status: 'FEEDBACK_PENDING', startedAt, feedback: { transport: 'MODBUS_TCP', logicalPoint: pointName }
    };
    return this.pollPhysicalFeedback(command, pending, profile);
  }
  private rejected(command: Pick<PlcControlCommand, 'commandId'>, status: PlcCommandResult['status'], errorCode: string): PlcCommandResult {
    return { commandId: command.commandId, accepted: false, executed: false, acknowledged: false, status, errorCode, completedAt: new Date().toISOString() };
  }
  private remember(command: PlcControlCommand, result: PlcCommandResult) { this.results.set(command.commandId, result); return result; }
  private requiresFreshStatus(action: PlcControlCommand['action']) { return ['PUMP_ON', 'VALVE_CLOSE', 'IRRIGATION_START'].includes(action); }
  private withFreshness(status: PlcStatus) {
    const maxAge = Number(this.config.get<string>('PLC_FEEDBACK_MAX_AGE_MS') ?? 5000);
    const fresh = Number.isInteger(maxAge) && maxAge > 0 && Date.now() - Date.parse(status.observedAt) <= maxAge;
    return { ...status, fresh, stale: !fresh };
  }
  private unavailableStatus(errorCode: string): PlcStatus { return { ...this.status, online: false, fresh: false, stale: true, errorCode }; }
  private feedbackPoint(profile: PlcProfile | undefined, logicalName: string) {
    const mapped = findPlcMappingByLogicalName(profile?.mapping, logicalName);
    if (mapped && Number.isInteger(mapped.address) && mapped.functionCode && mapped.functionCode !== 'UNCONFIRMED') return { address: mapped.address as number, type: mapped.type ?? mapped.functionCode };
    if (profile?.testOnly === true) {
      const point = profile.points?.[logicalName];
      if (point && Number.isInteger(point.address)) return { address: point.address as number, type: point.type };
    }
    return undefined;
  }
  private async readPoint(point: { address: number; type: string }) {
    const type = point.type.toLowerCase();
    if (type.includes('discrete') || type === '2') return this.modbusTransport!.readDiscreteInput(point.address);
    if (type.includes('coil') || type === '1') return this.modbusTransport!.readCoil(point.address);
    if (type.includes('inputregister') || type === '4') return Boolean(await this.modbusTransport!.readInputRegister(point.address));
    if (type.includes('holding') || type === '3') return Boolean(await this.modbusTransport!.readHoldingRegister(point.address));
    throw new Error('FEEDBACK_FUNCTION_UNSUPPORTED');
  }
  private async pollPhysicalFeedback(command: PlcControlCommand, pending: PlcCommandResult, profile?: PlcProfile): Promise<PlcCommandResult> {
    const expected: Partial<Record<PlcControlCommand['action'], { point: string; value: boolean; contradictory?: string }>> = {
      VALVE_OPEN: { point: 'valveOpenFeedback', value: true, contradictory: 'valveCloseFeedback' },
      VALVE_CLOSE: { point: 'valveCloseFeedback', value: true, contradictory: 'valveOpenFeedback' },
      PUMP_ON: { point: 'pumpRunningFeedback', value: true },
      PUMP_OFF: { point: 'pumpRunningFeedback', value: false },
      EMERGENCY_STOP: { point: 'pumpRunningFeedback', value: false }
    };
    const target = expected[command.action];
    const point = target ? this.feedbackPoint(profile, target.point) : undefined;
    if (!target || !point) return { ...pending, status: 'FEEDBACK_UNAVAILABLE', errorCode: 'FEEDBACK_UNAVAILABLE' };
    const timeoutMs = this.boundedConfig('PLC_FEEDBACK_TIMEOUT_MS', 2000, 1, 60_000);
    const intervalMs = this.boundedConfig('PLC_FEEDBACK_POLL_INTERVAL_MS', 100, 1, timeoutMs);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      try {
        const value = await this.readPoint(point);
        if (value === target.value) {
          const completedAt = new Date().toISOString();
          return { ...pending, status: 'PHYSICALLY_CONFIRMED', executed: true, physicalConfirmed: true, acknowledged: true, completedAt, feedback: { ...pending.feedback, fake: profile?.testOnly === true, physicalConfirmed: true, observedAt: completedAt, source: 'MODBUS_TCP', logicalPoint: target.point, expectedState: target.value, observedState: value, tenantId: command.tenantId, farmId: command.farmId, deviceId: command.deviceId, commandId: command.commandId } };
        }
        const contradictory = target.contradictory ? this.feedbackPoint(profile, target.contradictory) : undefined;
        if (contradictory && await this.readPoint(contradictory)) return { ...pending, status: 'FEEDBACK_MISMATCH', errorCode: 'FEEDBACK_MISMATCH', completedAt: new Date().toISOString() };
      } catch {
        return { ...pending, status: 'OUTCOME_UNKNOWN', errorCode: 'PLC_DISCONNECTED_DURING_CONFIRMATION', completedAt: new Date().toISOString() };
      }
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())));
    }
    return { ...pending, status: 'FEEDBACK_TIMEOUT', errorCode: 'FEEDBACK_TIMEOUT', completedAt: new Date().toISOString() };
  }
  private boundedConfig(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`INVALID_${key}`);
    return value;
  }
  private unsupported(deviceId: string, command: string, payload?: DeviceControlPayload, errorCode = 'PLC_COMMAND_UNSUPPORTED') {
    return { adapter: 'PLC_GATEWAY', deviceId, command, payload, ok: false, errorCode };
  }
}
