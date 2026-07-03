import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('ts-node/register');

const { IotTelemetryNormalizerService } = require('../src/modules/iot/iot-telemetry-normalizer.service.ts');
const { ThingsBoardWebhookService } = require('../src/modules/iot/thingsboard-webhook.service.ts');
const { DeviceControlService } = require('../src/modules/device-control/device-control.service.ts');

const context = { getTenantId: () => 'tenant-a', getRole: () => 'TENANT_ADMIN', isPlatformAdmin: () => false, getUserId: () => 'user-a', getRequestId: () => 'req-a' };
const prisma = {
  sensorRecord: {
    findUnique: async ({ where }) => (where.eventId === 'replay-event' ? { id: 'existing-sensor' } : null),
    findFirst: async () => null,
    create: async ({ data }) => ({ id: 'sensor-1', ...data })
  },
  device: { update: async ({ data }) => ({ id: 'device-1', ...data }) },
  cropSeason: { findFirst: async () => null },
  irrigationAdvice: { findFirst: async () => null, create: async ({ data }) => ({ id: 'advice-1', ...data }) },
  deviceTelemetrySnapshot: { upsert: async ({ create }) => ({ id: 'snapshot-1', ...create }) },
  eventLog: { create: async () => ({}) }
};
const normalizer = new IotTelemetryNormalizerService(prisma, context);

const normalized = normalizer.normalize({
  telemetry: {
    soilMoisture: 31,
    soilTemperature: 19,
    airTemperature: 22,
    airHumidity: 61,
    lightLux: 1200,
    co2Ppm: 430,
    pressurePa: 201000,
    flowRateLps: 2,
    waterLevel: 80,
    batteryPercent: 88,
    signalStrength: -70,
    gatewayOnline: true
  }
});
assert.equal(normalized.pressureKpa, 201);
assert.equal(normalized.flowRateM3h, 7.2);
assert.equal(normalized.gatewayOnline, true);
assert.equal(normalizer.assessQuality(normalized, new Date()).status, 'GOOD');
assert.equal(normalizer.assessQuality({ soilMoisture: 150 }, new Date()).status, 'WARNING');
assert.equal(normalizer.assessQuality(normalized, new Date(Date.now() + 10 * 60 * 1000)).status, 'CLOCK_DRIFT');
assert.equal(normalizer.assessQuality(normalized, new Date(), true).status, 'DUPLICATE');

let deadLetters = 0;
const deadLetterService = {
  create: async (input) => {
    deadLetters += 1;
    return { id: `dead-${deadLetters}`, ...input };
  }
};
let savedTelemetry = 0;
const webhook = new ThingsBoardWebhookService(
  prisma,
  {
    resolvePlotBinding: async ({ deviceName }) =>
      deviceName === 'unbound'
        ? { device: null, plotId: null, farmId: null }
        : { device: { id: 'device-1', tenantId: 'tenant-a', fieldId: 'field-a', field: { farmId: 'farm-a' } }, plotId: 'field-a', farmId: 'farm-a' },
    recordTelemetryAudit: async () => ({})
  },
  { evaluate: () => ({ action: 'NORMAL', message: 'ok' }) },
  { evaluate: async () => ({}) },
  { create: async () => ({}) },
  normalizer,
  deadLetterService
);

const testSecret = randomUUID();
process.env.THINGSBOARD_WEBHOOK_SECRET = testSecret;
process.env.THINGSBOARD_WEBHOOK_HMAC_SECRET = testSecret;
const dto = { deviceName: 'soil-1', eventId: 'event-1', ts: Date.now(), telemetry: { soilMoisture: 31, pressurePa: 120000 } };
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = `sha256=${createHmac('sha256', testSecret).update(`${timestamp}.${JSON.stringify(dto)}`).digest('hex')}`;
const ok = await webhook.handleTelemetry(testSecret, dto, { signature, timestamp, eventId: 'event-1' });
savedTelemetry += ok.saved ? 1 : 0;
assert.equal(ok.accepted, true);
assert.equal(ok.saved, true);

await assert.rejects(() => webhook.handleTelemetry(testSecret, dto, { timestamp, eventId: 'event-2' }), /Invalid webhook credentials/);
await assert.rejects(() => webhook.handleTelemetry(testSecret, dto, { signature: 'sha256=bad', timestamp, eventId: 'event-3' }), /Invalid webhook credentials/);
await assert.rejects(
  () => webhook.handleTelemetry(testSecret, dto, { signature, timestamp: String(Math.floor(Date.now() / 1000) - 600), eventId: 'event-4' }),
  /Invalid webhook credentials/
);
const replayDto = { ...dto, eventId: 'replay-event' };
const replaySignature = `sha256=${createHmac('sha256', testSecret).update(`${timestamp}.${JSON.stringify(replayDto)}`).digest('hex')}`;
const replay = await webhook.handleTelemetry(testSecret, replayDto, { signature: replaySignature, timestamp, eventId: 'replay-event' });
assert.equal(replay.duplicated, true);
const unboundDto = { ...dto, deviceName: 'unbound', eventId: 'unbound-event' };
const unboundTimestamp = String(Math.floor(Date.now() / 1000));
const unboundSignature = `sha256=${createHmac('sha256', testSecret).update(`${unboundTimestamp}.${JSON.stringify(unboundDto)}`).digest('hex')}`;
const unbound = await webhook.handleTelemetry(testSecret, unboundDto, { signature: unboundSignature, timestamp: unboundTimestamp, eventId: 'unbound-event' });
assert.equal(unbound.accepted, false);
assert.equal(deadLetters, 1);

let mqttCalls = 0;
let rpcCalls = 0;
let httpCalls = 0;
const counted = {
  openValve: async () => {
    mqttCalls += 1;
    return { ok: true };
  },
  closeValve: async () => {
    rpcCalls += 1;
    return { ok: true };
  },
  setValveOpening: async () => {
    httpCalls += 1;
    return { ok: true };
  }
};
const control = new DeviceControlService(
  counted,
  counted,
  counted,
  counted,
  counted,
  counted,
  { publish: () => assert.fail('event bus publish should not run in read-only rejection') },
  { get: (key) => ({ DEVICE_CONTROL_MODE: 'MOCK', DEVICE_CONTROL_DRY_RUN: 'true', VALVE_ALLOW_REAL_CONTROL: 'false', ENABLE_AUTO_EXECUTION: 'false' })[key] },
  prisma,
  context,
  { record: async () => ({}) }
);
const rejectedControl = await control.send('device-1', { command: 'VALVE_OPEN' });
assert.equal(rejectedControl.ok, false);
assert.equal(rejectedControl.code, 'READ_ONLY_MODE');
assert.equal(mqttCalls, 0);
assert.equal(rpcCalls, 0);
assert.equal(httpCalls, 0);

console.log('Stage 4 read-only IoT checks passed.');
console.log(JSON.stringify({ savedTelemetry, deadLetters, mqttCalls, rpcCalls, httpCalls }, null, 2));
