import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceControllerPort, DeviceControlPayload } from '../device-controller.interface';

@Injectable()
export class PlcGatewayDeviceController implements DeviceControllerPort {
  constructor(private readonly config: ConfigService) {}

  openValve(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'openValve', payload); }
  closeValve(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'closeValve', payload); }
  startIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'startPump', payload); }
  stopIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'stopPump', payload); }
  setValveOpening(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'setValveOpening', payload); }
  setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'setPumpFrequency', payload); }
  startFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'startFertigation', payload); }
  stopFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'stopFertigation', payload); }
  startDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'startDissolving', payload); }
  stopDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'stopDissolving', payload); }
  emergencyStop(deviceId: string, payload?: DeviceControlPayload) { return this.notConfigured(deviceId, 'emergencyStop', payload); }
  getStatus(deviceId: string) { return this.notConfigured(deviceId, 'getStatus'); }

  private notConfigured(deviceId: string, command: string, payload?: DeviceControlPayload) {
    return {
      adapter: 'PLC_GATEWAY',
      deviceId,
      command,
      payload,
      ok: false,
      errorCode: this.config.get<string>('PLC_GATEWAY_BASE_URL') ? 'PLC_GATEWAY_TOKEN_REQUIRED_OR_NOT_IMPLEMENTED' : 'PLC_GATEWAY_NOT_CONFIGURED',
      message: 'PLC_GATEWAY is a P12 skeleton. Real PLC cabinet control is reserved for later commissioning.'
    };
  }
}
