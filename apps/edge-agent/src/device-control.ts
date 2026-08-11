import { PlcTransportPort } from '@agrios/edge-core';
import { EdgeConfig, realWriteEligible } from './config';

export class FakePlcTransport implements PlcTransportPort {
  private online = false; readonly writes: Array<{ type: string; address: number; value: unknown }> = [];
  async connect() { this.online = true; } async disconnect() { this.online = false; }
  async healthCheck() { return { connected: this.online, transport: 'FAKE' }; }
  async readCoil() { return false; } async readDiscreteInput() { return false; } async readHoldingRegister() { return 0; } async readInputRegister() { return 0; }
  async writeCoil(address: number, value: boolean) { this.writes.push({ type: 'coil', address, value }); }
  async writeHoldingRegister(address: number, value: number) { this.writes.push({ type: 'register', address, value }); }
  async transaction<T>(operation: () => Promise<T>) { return operation(); }
}

export class DisabledPlcTransport extends FakePlcTransport { async healthCheck() { return { connected: false, transport: 'MODBUS_TCP_DISABLED', error: 'REAL_PROFILE_OR_WRITE_GATES_INVALID' }; } }

export class EdgeDeviceControl {
  constructor(private readonly config: EdgeConfig, private readonly transport: PlcTransportPort, private readonly writeEligible: boolean, private readonly recordExecution: (commandId: string, action: string) => Promise<void>) {}
  async execute(command: { commandId: string; action: string }) {
    if (this.config.plc.transport !== 'FAKE' && (!this.writeEligible || !realWriteEligible(this.config))) return { status: 'SAFETY_BLOCKED', executed: false, errorCode: 'REAL_WRITE_DISABLED' };
    await this.recordExecution(command.commandId, command.action);
    return { status: 'SUCCEEDED', executed: true, transport: this.config.plc.transport };
  }
  health() { return this.transport.healthCheck(); }
}
