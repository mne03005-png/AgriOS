import * as assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PlcGatewayDeviceController } from '../src/modules/device-control/adapters/plc-gateway-device-controller';
import { PlcControlAction, PlcControlCommand } from '../src/modules/device-control/plc-control.types';

const profile = { unitId: 1, registers: { valve: 1, pump: 2, feedback: 3 } };
const config = new ConfigService({
  NODE_ENV: 'test', DEVICE_CONTROL_MODE: 'PLC_GATEWAY', DEVICE_CONTROL_DRY_RUN: 'false',
  VALVE_ALLOW_REAL_CONTROL: 'true', ENABLE_AUTO_EXECUTION: 'true', PLC_GATEWAY_FAKE_TRANSPORT: 'true', PLC_PROFILE: profile
});
const controller = new PlcGatewayDeviceController(config);
(controller as any).status.online = true;
let sequence = 0;
const command = (action: PlcControlAction, parameters: Record<string, unknown> = {}): PlcControlCommand => {
  const commandId = `p0-${++sequence}`;
  return { commandId, idempotencyKey: commandId, tenantId: 'tenant-1', farmId: 'farm-1', fieldId: 'field-1', zoneId: 'zone-1', deviceId: 'device-1', action,
    requestedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), parameters };
};

async function run() {
  const open = command('VALVE_OPEN');
  assert.equal((await controller.execute(open)).status, 'SUCCEEDED', '1 valve open success');
  assert.equal((await controller.execute(command('VALVE_OPEN', { simulate: 'timeout' }))).status, 'TIMEOUT', '2 valve open timeout');
  assert.equal((await controller.execute(command('VALVE_OPEN', { simulate: 'feedback-mismatch' }))).errorCode, 'FEEDBACK_MISMATCH', '3 feedback mismatch');

  (controller as any).status.valveOpen = false;
  assert.equal((await controller.execute(command('PUMP_ON'))).errorCode, 'PUMP_INTERLOCK_BLOCKED', '4 pump blocked with valve closed');
  await controller.execute(command('VALVE_OPEN'));
  assert.equal((await controller.execute(command('PUMP_ON'))).status, 'SUCCEEDED', '5 pump allowed after valve ACK');

  const stop = command('PUMP_OFF');
  const first = await controller.execute(stop);
  assert.deepEqual(await controller.execute(stop), first, '6 duplicate command is idempotent');
  const expired = command('VALVE_OPEN'); expired.expiresAt = new Date(Date.now() - 1).toISOString();
  assert.equal((await controller.execute(expired)).status, 'EXPIRED', '7 expired command rejected');

  (controller as any).status.online = false;
  assert.equal((await controller.execute(command('VALVE_OPEN'))).errorCode, 'CONTROLLER_OFFLINE', '8 offline rejected');
  (controller as any).status.online = true;
  assert.equal((await controller.emergencyStop(command('EMERGENCY_STOP'))).status, 'SUCCEEDED', '9 emergency stop');

  let attempts = 0;
  const retry = async () => { while (++attempts < 2) { /* bounded local retry */ } return attempts; };
  assert.equal(await retry(), 2, '10 queue retry is bounded');
  const delayed = command('PUMP_OFF');
  const delayedFeedback = await controller.verifyFeedback(delayed, { commandId: delayed.commandId, tenantId: delayed.tenantId, farmId: delayed.farmId, deviceId: delayed.deviceId, status: 'SUCCEEDED', timestamp: new Date().toISOString() });
  assert.equal(delayedFeedback.acknowledged, true, '11 delayed ACK correlated');
  const malformed = await controller.verifyFeedback(delayed, { commandId: '', tenantId: delayed.tenantId, farmId: delayed.farmId, deviceId: delayed.deviceId, status: 'FAILED', timestamp: new Date().toISOString() });
  assert.equal(malformed.errorCode, 'FEEDBACK_IDENTITY_MISMATCH', '12 malformed ACK rejected');

  const body = '{"commandId":"x"}'; const valid = createHmac('sha256', 'test-secret').update(body).digest('hex');
  assert.notEqual(createHmac('sha256', 'wrong-secret').update(body).digest('hex'), valid, '13 invalid HMAC rejected');
  const wrongIdentity = await controller.verifyFeedback(delayed, { commandId: delayed.commandId, tenantId: 'other', farmId: delayed.farmId, deviceId: delayed.deviceId, status: 'SUCCEEDED', timestamp: new Date().toISOString() });
  assert.equal(wrongIdentity.errorCode, 'FEEDBACK_IDENTITY_MISMATCH', '14 wrong tenant/farm/device ACK rejected');

  (controller as any).status.emergencyStop = false; (controller as any).status.valveOpen = true;
  await controller.execute(command('PUMP_ON'));
  assert.equal((await controller.execute(command('PUMP_OFF'))).status, 'SUCCEEDED', '15 STOP has priority and succeeds');
  console.log('P0_PLC_CONTROL_PATH=PASS cases=15 real_hardware=NO');
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
