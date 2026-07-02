import { Injectable } from '@nestjs/common';
import { DeviceControllerPort, DeviceControlPayload } from '../device-controller.interface';

@Injectable()
export class ThingsboardDeviceController implements DeviceControllerPort {
  async openValve(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'openValve', payload);
  }

  async closeValve(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'closeValve', payload);
  }

  async startIrrigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'PUMP_ON', payload);
  }

  async stopIrrigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'PUMP_OFF', payload);
  }

  async setValveOpening(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'setValveOpening', payload);
  }

  async testOpenValve(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'testOpenValve', payload);
  }

  async setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'SET_PUMP_FREQUENCY', payload);
  }

  async startFertigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'START_FERTIGATION', payload);
  }

  async stopFertigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'STOP_FERTIGATION', payload);
  }

  async startDissolving(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'START_DISSOLVING', payload);
  }

  async stopDissolving(deviceId: string, payload?: DeviceControlPayload) {
    return this.placeholder(deviceId, 'STOP_DISSOLVING', payload);
  }

  async getStatus(deviceId: string) {
    return { adapter: 'thingsboard', deviceId, status: 'TODO_RPC_STATUS' };
  }

  async getValveStatus(deviceId: string) {
    return this.placeholder(deviceId, 'getValveStatus');
  }

  private placeholder(deviceId: string, command: string, payload?: DeviceControlPayload) {
    return { adapter: 'thingsboard', deviceId, command, payload, ok: false, todo: 'RPC adapter skeleton only; webhook ingestion is unchanged.' };
  }
}
