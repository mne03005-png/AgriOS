import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreModbusTcpTransport } from '@agrios/edge-core';

@Injectable()
export class ModbusTcpTransport extends CoreModbusTcpTransport {
  constructor(config: ConfigService) {
    super(() => ({
      host: config.get<string>('PLC_MODBUS_HOST') ?? '127.0.0.1',
      port: numeric(config, 'PLC_MODBUS_PORT', 502), unitId: numeric(config, 'PLC_MODBUS_UNIT_ID', 1),
      connectTimeoutMs: numeric(config, 'PLC_CONNECT_TIMEOUT_MS', 2000), commandTimeoutMs: numeric(config, 'PLC_COMMAND_TIMEOUT_MS', 2000),
      retry: numeric(config, 'PLC_COMMAND_RETRY', 0)
    }), () => config.get<string>('DEVICE_CONTROL_MODE') === 'PLC_GATEWAY' && config.get<string>('DEVICE_CONTROL_DRY_RUN') === 'false'
      && config.get<string>('VALVE_ALLOW_REAL_CONTROL') === 'true' && config.get<string>('ENABLE_AUTO_EXECUTION') === 'true'
      && config.get<string>('PLC_TRANSPORT') === 'MODBUS_TCP' && config.get<string>('PLC_REAL_WRITE_ENABLED') === 'true');
  }
}
function numeric(config: ConfigService, key: string, fallback: number) {
  return Number(config.get<string>(key) ?? fallback);
}
