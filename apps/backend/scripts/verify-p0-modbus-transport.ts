import * as assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { ServerTCP } from 'modbus-serial';
import { ModbusTcpTransport } from '../src/modules/device-control/transports/modbus-tcp.transport';
import { PlcGatewayDeviceController } from '../src/modules/device-control/adapters/plc-gateway-device-controller';
import { PlcControlAction, PlcControlCommand } from '../src/modules/device-control/plc-control.types';

// TEST_ONLY addresses. They are not Siemens LOGO! addresses and must never enter a real profile.
const TEST = { coil: 10, stop: 11, discrete: 20, valveOpenFeedback: 21, valveCloseFeedback: 22, pumpRunningFeedback: 23, overloadFeedback: 24, emergencyFeedback: 25, holding: 30, input: 40 } as const;
const coils = new Map<number, boolean>([[TEST.coil, false], [TEST.stop, false]]);
const discrete = new Map<number, boolean>([[TEST.discrete, true], [TEST.valveOpenFeedback, false], [TEST.valveCloseFeedback, true], [TEST.pumpRunningFeedback, false], [TEST.overloadFeedback, false], [TEST.emergencyFeedback, false]]);
const holding = new Map<number, number>([[TEST.holding, 123]]);
const input = new Map<number, number>([[TEST.input, 456]]);
let coilWrites = 0;

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function startServer(port: number, unitId = 7) {
  const server = new ServerTCP({
    getCoil: (address: number) => coils.get(address) ?? false,
    getDiscreteInput: (address: number) => discrete.get(address) ?? false,
    getHoldingRegister: (address: number) => holding.get(address) ?? 0,
    getInputRegister: (address: number) => input.get(address) ?? 0,
    setCoil: (address: number, value: boolean) => { coilWrites += 1; coils.set(address, value); if (address === TEST.coil) { discrete.set(TEST.valveOpenFeedback, value); discrete.set(TEST.valveCloseFeedback, !value); } if (address === TEST.stop) discrete.set(TEST.pumpRunningFeedback, false); },
    setRegister: (address: number, value: number) => { holding.set(address, value); }
  }, { host: '127.0.0.1', port, unitID: unitId });
  await new Promise<void>((resolve, reject) => { server.once('initialized', () => resolve()); server.once('serverError', reject); });
  return server;
}

const configFor = (port: number, overrides: Record<string, unknown> = {}) => new ConfigService({
  NODE_ENV: 'test', DEVICE_CONTROL_MODE: 'PLC_GATEWAY', DEVICE_CONTROL_DRY_RUN: 'false', VALVE_ALLOW_REAL_CONTROL: 'true',
  ENABLE_AUTO_EXECUTION: 'true', PLC_TRANSPORT: 'MODBUS_TCP', PLC_REAL_WRITE_ENABLED: 'true', PLC_MODBUS_HOST: '127.0.0.1',
  PLC_MODBUS_PORT: String(port), PLC_MODBUS_UNIT_ID: '7', PLC_CONNECT_TIMEOUT_MS: '100', PLC_COMMAND_TIMEOUT_MS: '150', PLC_COMMAND_RETRY: '1',
  PLC_FEEDBACK_TIMEOUT_MS: '80', PLC_FEEDBACK_POLL_INTERVAL_MS: '5',
  PLC_PROFILE: { testOnly: true, unitId: 7, points: { valveOpen: { type: 'coil', address: TEST.coil }, valveClose: { type: 'coil', address: TEST.stop }, pumpStart: { type: 'coil', address: TEST.coil }, pumpStop: { type: 'coil', address: TEST.stop }, emergencyStop: { type: 'discreteInput', address: TEST.emergencyFeedback }, noWater: { type: 'discreteInput', address: TEST.overloadFeedback }, overloadTrip: { type: 'discreteInput', address: TEST.overloadFeedback }, valveOpenFeedback: { type: 'discreteInput', address: TEST.valveOpenFeedback }, valveCloseFeedback: { type: 'discreteInput', address: TEST.valveCloseFeedback }, pumpRunningFeedback: { type: 'discreteInput', address: TEST.pumpRunningFeedback } } },
  ...overrides
});

let id = 0;
const command = (action: PlcControlAction): PlcControlCommand => {
  const commandId = `modbus-test-${++id}`;
  return { commandId, idempotencyKey: commandId, tenantId: 'test-tenant', farmId: 'test-farm', deviceId: 'test-device', action,
    requestedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10_000).toISOString(), parameters: {} };
};

async function run() {
  const port = await freePort();
  let server = await startServer(port);
  const transport = new ModbusTcpTransport(configFor(port));
  await transport.connect();
  assert.equal((await transport.healthCheck()).connected, true, '1 connect success');

  const timeoutTransport = new ModbusTcpTransport(configFor(port));
  (timeoutTransport as any).client.connectTCP = () => new Promise(() => undefined);
  await assert.rejects(() => timeoutTransport.connect(), /MODBUS_CONNECT_TIMEOUT/, '2 connect timeout');

  await transport.disconnect(); await transport.connect();
  assert.equal((await transport.healthCheck()).connected, true, '3 reconnect');
  assert.equal(await transport.readDiscreteInput(TEST.discrete), true, '4 read DI');
  assert.equal(await transport.readCoil(TEST.coil), false, '5 read coil');
  assert.equal(await transport.readHoldingRegister(TEST.holding), 123, '6 read holding register');
  assert.equal(await transport.readInputRegister(TEST.input), 456, '6b read input register');
  await transport.writeCoil(TEST.coil, true); assert.equal(coils.get(TEST.coil), true, '7 write coil');
  await transport.writeHoldingRegister(TEST.holding, 789); assert.equal(holding.get(TEST.holding), 789, '8 write register');

  const wrongUnit = new ModbusTcpTransport(configFor(port, { PLC_MODBUS_UNIT_ID: '8', PLC_COMMAND_RETRY: '0' }));
  await wrongUnit.connect();
  await assert.rejects(() => wrongUnit.readCoil(TEST.coil), () => true, '9 wrong unit ID');
  await assert.rejects(() => transport.readCoil(-1), /INVALID_MODBUS_ADDRESS/, '10 invalid address');

  const slow = new ModbusTcpTransport(configFor(port));
  (slow as any).connect = async () => { (slow as any).connected = true; };
  await assert.rejects(() => slow.transaction(() => new Promise(() => undefined)), /MODBUS_COMMAND_TIMEOUT/, '11 command timeout');

  await transport.disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await assert.rejects(() => transport.readCoil(TEST.coil), () => true, '12 server disconnect');
  server = await startServer(port);

  const chainTransport = new ModbusTcpTransport(configFor(port));
  const controller = new PlcGatewayDeviceController(configFor(port), chainTransport);
  (controller as any).status.online = true;
  const duplicate = command('VALVE_OPEN');
  const before = coilWrites; const firstDuplicate = await controller.execute(duplicate); await controller.execute(duplicate);
  assert.equal(coilWrites, before + 1, `13 duplicate command writes once (${firstDuplicate.status}:${firstDuplicate.errorCode ?? 'OK'})`);
  await controller.execute(command('PUMP_OFF')); assert.equal(coils.get(TEST.stop), true, '14 STOP priority');
  await controller.emergencyStop(command('EMERGENCY_STOP')); assert.equal(coils.get(TEST.stop), true, '15 emergency stop uses stop output');

  const feedbackCommand = command('VALVE_OPEN');
  const mismatch = await controller.verifyFeedback(feedbackCommand, { commandId: feedbackCommand.commandId, tenantId: 'wrong', farmId: feedbackCommand.farmId, deviceId: feedbackCommand.deviceId, status: 'SUCCEEDED', timestamp: new Date().toISOString() });
  assert.equal(mismatch.errorCode, 'FEEDBACK_IDENTITY_MISMATCH', '16 feedback mismatch');
  discrete.set(TEST.valveOpenFeedback, false);
  assert.equal((await controller.execute(command('PUMP_ON'))).errorCode, 'PUMP_INTERLOCK_BLOCKED', '17 valve-open then pump-start interlock');
  discrete.set(TEST.pumpRunningFeedback, true);
  assert.equal((await controller.execute(command('VALVE_CLOSE'))).errorCode, 'STOP_PUMP_BEFORE_VALVE_CLOSE', '18 pump-stop then valve-close sequence');

  const blocked = new ModbusTcpTransport(configFor(port, { PLC_REAL_WRITE_ENABLED: 'false' }));
  await assert.rejects(
    () => blocked.writeCoil(TEST.coil, true),
    (error: any) => error?.response?.errorCode === 'PLC_REAL_WRITE_DISABLED',
    'write gate defaults closed'
  );
  await chainTransport.disconnect(); await wrongUnit.disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('P0_MODBUS_TRANSPORT=PASS cases=18 fake_server=YES real_logo=NO real_write=NO');
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
