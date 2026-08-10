import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ModbusRTU from 'modbus-serial';
import { PlcTransportHealth, PlcTransportOptions, PlcTransportPort } from './plc-transport.port';

@Injectable()
export class ModbusTcpTransport implements PlcTransportPort {
  private client = new ModbusRTU();
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async connect() {
    if (this.connected) return;
    const options = this.options();
    this.client.setID(options.unitId);
    this.client.setTimeout(options.commandTimeoutMs);
    try {
      await this.withTimeout(this.client.connectTCP(options.host, { port: options.port }), options.connectTimeoutMs, 'MODBUS_CONNECT_TIMEOUT');
      this.connected = true;
    } catch (error) {
      this.connected = false;
      this.client.destroy(() => undefined);
      throw error;
    }
  }

  async disconnect() {
    if (this.client.isOpen) await new Promise<void>((resolve) => this.client.close(() => resolve()));
    this.connected = false;
  }

  async healthCheck(): Promise<PlcTransportHealth> {
    return { connected: this.connected && this.client.isOpen, transport: 'MODBUS_TCP' };
  }

  async readCoil(address: number) { return (await this.executeRead(() => this.client.readCoils(this.address(address), 1))).data[0]; }
  async readDiscreteInput(address: number) { return (await this.executeRead(() => this.client.readDiscreteInputs(this.address(address), 1))).data[0]; }
  async readHoldingRegister(address: number) { return (await this.executeRead(() => this.client.readHoldingRegisters(this.address(address), 1))).data[0]; }
  async readInputRegister(address: number) { return (await this.executeRead(() => this.client.readInputRegisters(this.address(address), 1))).data[0]; }

  async writeCoil(address: number, value: boolean) {
    this.assertWriteEnabled();
    await this.transaction(() => this.client.writeCoil(this.address(address), value));
  }

  async writeHoldingRegister(address: number, value: number) {
    this.assertWriteEnabled();
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new BadRequestException('INVALID_MODBUS_REGISTER_VALUE');
    await this.transaction(() => this.client.writeRegister(this.address(address), value));
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const options = this.options();
    let lastError: unknown;
    for (let attempt = 0; attempt <= options.retry; attempt += 1) {
      try {
        if (!this.connected || !this.client.isOpen) await this.connect();
        return await this.withTimeout(operation(), options.commandTimeoutMs, 'MODBUS_COMMAND_TIMEOUT');
      } catch (error) {
        lastError = error;
        this.connected = false;
        if (attempt < options.retry) {
          try { await this.disconnect(); } catch { /* reconnect on next attempt */ }
          this.client = new ModbusRTU();
        }
      }
    }
    throw new ServiceUnavailableException(lastError instanceof Error ? lastError.message : 'MODBUS_TRANSACTION_FAILED');
  }

  private executeRead<T>(operation: () => Promise<T>) { return this.transaction(operation); }

  private assertWriteEnabled() {
    const required: Record<string, string> = {
      DEVICE_CONTROL_MODE: 'PLC_GATEWAY',
      DEVICE_CONTROL_DRY_RUN: 'false',
      VALVE_ALLOW_REAL_CONTROL: 'true',
      ENABLE_AUTO_EXECUTION: 'true',
      PLC_TRANSPORT: 'MODBUS_TCP',
      PLC_REAL_WRITE_ENABLED: 'true'
    };
    const missing = Object.entries(required).filter(([key, value]) => this.config.get<string>(key) !== value).map(([key]) => key);
    if (missing.length) throw new BadRequestException({ errorCode: 'PLC_REAL_WRITE_DISABLED', missing });
  }

  private options(): PlcTransportOptions {
    return {
      host: this.config.get<string>('PLC_MODBUS_HOST') ?? '127.0.0.1',
      port: this.integer('PLC_MODBUS_PORT', 502, 1, 65535),
      unitId: this.integer('PLC_MODBUS_UNIT_ID', 1, 0, 255),
      connectTimeoutMs: this.integer('PLC_CONNECT_TIMEOUT_MS', 2000, 1, 60_000),
      commandTimeoutMs: this.integer('PLC_COMMAND_TIMEOUT_MS', 2000, 1, 60_000),
      retry: this.integer('PLC_COMMAND_RETRY', 0, 0, 5)
    };
  }

  private integer(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new BadRequestException(`INVALID_${key}`);
    return value;
  }

  private address(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new BadRequestException('INVALID_MODBUS_ADDRESS');
    return value;
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number, code: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(code)), timeoutMs); })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
