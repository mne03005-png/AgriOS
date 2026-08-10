import { BadRequestException } from '@nestjs/common';
import { PlcTransportHealth, PlcTransportPort } from './plc-transport.port';

export class FakePlcTransport implements PlcTransportPort {
  connected = false;
  readonly coils = new Map<number, boolean>();
  readonly discreteInputs = new Map<number, boolean>();
  readonly holdingRegisters = new Map<number, number>();
  readonly inputRegisters = new Map<number, number>();

  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  async healthCheck(): Promise<PlcTransportHealth> { return { connected: this.connected, transport: 'FAKE' }; }
  async readCoil(address: number) { return this.read(this.coils, address, false); }
  async writeCoil(address: number, value: boolean) { this.write(this.coils, address, value); }
  async readDiscreteInput(address: number) { return this.read(this.discreteInputs, address, false); }
  async readHoldingRegister(address: number) { return this.read(this.holdingRegisters, address, 0); }
  async writeHoldingRegister(address: number, value: number) { this.write(this.holdingRegisters, address, value); }
  async readInputRegister(address: number) { return this.read(this.inputRegisters, address, 0); }
  async transaction<T>(operation: () => Promise<T>) { if (!this.connected) await this.connect(); return operation(); }
  private read<T>(source: Map<number, T>, address: number, fallback: T) { this.address(address); return source.get(address) ?? fallback; }
  private write<T>(target: Map<number, T>, address: number, value: T) { this.address(address); target.set(address, value); }
  private address(value: number) { if (!Number.isInteger(value) || value < 0) throw new BadRequestException('INVALID_MODBUS_ADDRESS'); }
}
