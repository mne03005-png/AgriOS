import { Injectable } from '@nestjs/common';
import { DeviceControllerPort, DeviceControlPayload } from '../device-controller.interface';

@Injectable()
export class MockDeviceController implements DeviceControllerPort {
  async openValve(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'VALVE_OPEN', payload, ok: true };
  }

  async closeValve(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'VALVE_CLOSE', payload, ok: true };
  }

  async startIrrigation(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'PUMP_ON', payload, ok: true };
  }

  async stopIrrigation(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'PUMP_OFF', payload, ok: true };
  }

  async setValveOpening(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'SET_VALVE_OPENING', payload, ok: true };
  }

  async testOpenValve(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'TEST_OPEN_VALVE', payload, ok: true, valveStatus: 'OPEN', valveOpeningPercent: 5 };
  }

  async setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'SET_PUMP_FREQUENCY', payload, ok: true };
  }

  async startFertigation(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'START_FERTIGATION', payload, ok: true };
  }

  async stopFertigation(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'STOP_FERTIGATION', payload, ok: true };
  }

  async startDissolving(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'START_DISSOLVING', payload, ok: true };
  }

  async stopDissolving(deviceId: string, payload?: DeviceControlPayload) {
    return { adapter: 'mock', deviceId, command: 'STOP_DISSOLVING', payload, ok: true };
  }

  async getStatus(deviceId: string) {
    return { adapter: 'mock', deviceId, online: true, status: 'READY' };
  }

  async getValveStatus(deviceId: string) {
    return { adapter: 'mock', deviceId, online: true, valveStatus: 'CLOSED', valveOpeningPercent: 0 };
  }
}
