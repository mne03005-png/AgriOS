import { Injectable } from '@nestjs/common';
import { DeviceService } from '../../device/device.service';
import { DeviceControllerPort, DeviceControlPayload } from '../device-controller.interface';

@Injectable()
export class MqttDeviceController implements DeviceControllerPort {
  constructor(private readonly deviceService: DeviceService) {}

  openValve(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'VALVE_OPEN');
  }

  closeValve(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'VALVE_CLOSE');
  }

  startIrrigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'PUMP_ON');
  }

  stopIrrigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'PUMP_OFF');
  }

  setValveOpening(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'SET_VALVE_OPENING' as any);
  }

  testOpenValve(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'VALVE_OPEN' as any);
  }

  setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'SET_PUMP_FREQUENCY' as any);
  }

  startFertigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'START_FERTIGATION' as any);
  }

  stopFertigation(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'STOP_FERTIGATION' as any);
  }

  startDissolving(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'START_DISSOLVING' as any);
  }

  stopDissolving(deviceId: string, payload?: DeviceControlPayload) {
    return this.deviceService.sendCommand(deviceId, 'STOP_DISSOLVING' as any);
  }

  async getStatus(deviceId: string) {
    return this.deviceService.findOne(deviceId);
  }

  async getValveStatus(deviceId: string) {
    return this.deviceService.findOne(deviceId);
  }
}
