export type DeviceControlPayload = Record<string, unknown> | undefined;
export type DeviceControlResult = Promise<unknown> | unknown;

export interface DeviceControllerPort {
  openValve(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  closeValve(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  testOpenValve?(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  startPump?(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  stopPump?(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  startIrrigation(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  stopIrrigation(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  setValveOpening(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  setPumpFrequency(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  startFertigation(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  stopFertigation(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  emergencyStop?(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  startDissolving(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  stopDissolving(deviceId: string, payload?: DeviceControlPayload): DeviceControlResult;
  getStatus(deviceId: string): DeviceControlResult;
  getValveStatus?(deviceId: string): DeviceControlResult;
}
