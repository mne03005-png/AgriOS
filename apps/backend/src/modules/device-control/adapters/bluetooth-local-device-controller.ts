import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceControllerPort, DeviceControlPayload } from '../device-controller.interface';

@Injectable()
export class BluetoothLocalDeviceController implements DeviceControllerPort {
  constructor(private readonly config: ConfigService) {}

  openValve(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'openValve', payload); }
  closeValve(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'closeValve', payload); }
  startIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'startPump', payload); }
  stopIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'stopPump', payload); }
  setValveOpening(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'setValveOpening', payload); }
  setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'setPumpFrequency', payload); }
  startFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'startFertigation', payload); }
  stopFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'stopFertigation', payload); }
  startDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'startDissolving', payload); }
  stopDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'stopDissolving', payload); }
  emergencyStop(deviceId: string, payload?: DeviceControlPayload) { return this.installerOnly(deviceId, 'emergencyStop', payload); }
  getStatus(deviceId: string) { return this.installerOnly(deviceId, 'getStatus'); }

  private installerOnly(deviceId: string, command: string, payload?: DeviceControlPayload) {
    const enabled = (this.config.get<string>('ENABLE_BLUETOOTH_LOCAL') ?? 'false').toLowerCase() === 'true';
    return {
      adapter: 'BLUETOOTH_LOCAL',
      deviceId,
      command,
      payload,
      ok: false,
      errorCode: enabled ? 'INSTALLER_ONLY_NOT_IMPLEMENTED' : 'BLUETOOTH_LOCAL_DISABLED',
      message: 'Bluetooth local mode is only for installer/maintenance workflow skeleton and cannot bypass Safety/Approval.'
    };
  }
}
