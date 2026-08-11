import { strict as assert } from 'node:assert';
import test from 'node:test';
import { evaluatePlcInterlock, isRealPlcWriteEnabled, isSafetyDryRunEnabled, RealPlcWriteGateInput } from '../plc-safety-rules';

const safeStatus = { emergencyStop: false, noWater: false, overloadTrip: false, pumpRunning: false, valveOpen: true };
const allowed = (action: string, override = {}) => evaluatePlcInterlock(action, { ...safeStatus, ...override });
const interlocks: Array<[string, string, object, boolean, string?]> = [
  ['PUMP_ON all safe', 'PUMP_ON', {}, true], ['PUMP_ON emergency stop', 'PUMP_ON', { emergencyStop: true }, false, 'PUMP_INTERLOCK_BLOCKED'],
  ['PUMP_ON no water', 'PUMP_ON', { noWater: true }, false, 'PUMP_INTERLOCK_BLOCKED'], ['PUMP_ON overload', 'PUMP_ON', { overloadTrip: true }, false, 'PUMP_INTERLOCK_BLOCKED'],
  ['PUMP_ON valve closed', 'PUMP_ON', { valveOpen: false }, false, 'PUMP_INTERLOCK_BLOCKED'], ['VALVE_OPEN emergency stop', 'VALVE_OPEN', { emergencyStop: true }, false, 'EMERGENCY_STOP_ACTIVE'],
  ['VALVE_OPEN safe', 'VALVE_OPEN', {}, true], ['VALVE_CLOSE pump running', 'VALVE_CLOSE', { pumpRunning: true }, false, 'STOP_PUMP_BEFORE_VALVE_CLOSE'],
  ['VALVE_CLOSE pump stopped', 'VALVE_CLOSE', {}, true], ['PUMP_OFF emergency stop', 'PUMP_OFF', { emergencyStop: true }, true],
  ['EMERGENCY_STOP', 'EMERGENCY_STOP', { emergencyStop: true }, true]
];
for (const [name, action, status, expected, errorCode] of interlocks) test(name, () => { const result = allowed(action, status); assert.equal(result.allowed, expected); if (!result.allowed) assert.equal(result.errorCode, errorCode); });

const enabled: RealPlcWriteGateInput = { deviceControlMode: 'PLC_GATEWAY', deviceControlDryRun: 'false', valveAllowRealControl: 'true', enableAutoExecution: 'true', plcTransport: 'MODBUS_TCP', plcRealWriteEnabled: 'true' };
test('all six exact real-write gates enable', () => assert.equal(isRealPlcWriteEnabled(enabled), true));
for (const key of Object.keys(enabled) as Array<keyof RealPlcWriteGateInput>) {
  test(`invalid ${key} disables real write`, () => assert.equal(isRealPlcWriteEnabled({ ...enabled, [key]: 'invalid' }), false));
  test(`missing ${key} disables real write`, () => assert.equal(isRealPlcWriteEnabled({ ...enabled, [key]: undefined }), false));
}
for (const [key, value] of [['deviceControlDryRun', '1'], ['deviceControlDryRun', 'yes'], ['plcRealWriteEnabled', '1'], ['valveAllowRealControl', 'TRUE'], ['deviceControlDryRun', 'FALSE'], ['plcTransport', 'modbus_tcp']] as const) test(`${key}=${value} is rejected`, () => assert.equal(isRealPlcWriteEnabled({ ...enabled, [key]: value }), false));
for (const [value, expected] of [[undefined, true], ['true', true], ['false', false], ['1', true], ['0', true], ['yes', true], ['on', true], ['TRUE', true], ['FALSE', true]] as const) test(`dry-run ${String(value)} => ${expected}`, () => assert.equal(isSafetyDryRunEnabled(value), expected));
