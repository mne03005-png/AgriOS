import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceControllerPort, DeviceControlPayload } from '../device-controller.interface';

@Injectable()
export class EdgeHttpDeviceController implements DeviceControllerPort {
  constructor(private readonly config: ConfigService) {}

  openValve(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'open-valve', payload); }
  closeValve(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'close-valve', payload); }
  startIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'startPump', payload); }
  stopIrrigation(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'stopPump', payload); }
  setValveOpening(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'set-valve-opening', payload); }
  testOpenValve(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'test-valve', payload); }
  setPumpFrequency(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'setPumpFrequency', payload); }
  startFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'startFertigation', payload); }
  stopFertigation(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'stopFertigation', payload); }
  startDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'startDissolving', payload); }
  stopDissolving(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'stopDissolving', payload); }
  emergencyStop(deviceId: string, payload?: DeviceControlPayload) { return this.command(deviceId, 'emergencyStop', payload); }
  getStatus(deviceId: string) { return this.status(deviceId); }
  getValveStatus(deviceId: string) { return this.status(deviceId); }

  private async command(deviceId: string, command: string, payload?: DeviceControlPayload) {
    const baseUrl = this.config.get<string>('EDGE_CONTROLLER_BASE_URL');
    if (!baseUrl) {
      return this.notConfigured(deviceId, command, payload);
    }
    return this.request(`${baseUrl.replace(/\/$/, '')}/commands/${command}`, 'POST', {
      deviceId,
      requestId: this.requestId(command),
      payload: payload ?? {}
    });
  }

  private async status(deviceId: string) {
    const baseUrl = this.config.get<string>('EDGE_CONTROLLER_BASE_URL');
    if (!baseUrl) {
      return this.notConfigured(deviceId, 'getStatus');
    }
    return this.request(`${baseUrl.replace(/\/$/, '')}/devices/${encodeURIComponent(deviceId)}/status`, 'GET');
  }

  private async request(url: string, method: 'GET' | 'POST', body?: unknown) {
    const token = this.config.get<string>('EDGE_CONTROLLER_TOKEN');
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await response.text();
      const data = text ? (JSON.parse(text) as unknown) : {};
      return {
        adapter: 'EDGE_HTTP',
        ok: response.ok,
        statusCode: response.status,
        result: data
      };
    } catch (error) {
      return {
        adapter: 'EDGE_HTTP',
        ok: false,
        errorCode: 'EDGE_CONTROLLER_REQUEST_FAILED',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private requestId(command: string) {
    return `agrios-edge-${command}-${Date.now()}`;
  }

  private notConfigured(deviceId: string, command: string, payload?: DeviceControlPayload) {
    return {
      adapter: 'EDGE_HTTP',
      deviceId,
      command,
      payload,
      ok: false,
      errorCode: this.config.get<string>('EDGE_CONTROLLER_BASE_URL') ? 'EDGE_TOKEN_REQUIRED_OR_NOT_IMPLEMENTED' : 'EDGE_CONTROLLER_NOT_CONFIGURED',
      message: 'EDGE_HTTP is a P12 skeleton. Real edge controller integration is reserved for later hardware commissioning.'
    };
  }
}
