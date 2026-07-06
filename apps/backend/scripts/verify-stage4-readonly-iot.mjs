import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('ts-node/register');

const { IotTelemetryNormalizerService } = require('../src/modules/iot/iot-telemetry-normalizer.service.ts');
const { ThingsBoardWebhookService } = require('../src/modules/iot/thingsboard-webhook.service.ts');
const { DeviceControlService } = require('../src/modules/device-control/device-control.service.ts');
const { IotDeviceService } = require('../src/modules/iot/iot-device.service.ts');
const { IotWebhookDeadLetterService } = require('../src/modules/iot/iot-webhook-dead-letter.service.ts');
const { IotSyncAuditService } = require('../src/modules/iot/iot-sync-audit.service.ts');
const { MqttService } = require('../src/modules/mqtt/mqtt.service.ts');

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

const forbiddenKeys = new Set([
  'thingsboardaccesstoken',
  'accesstoken',
  'devicetoken',
  'mqttpassword',
  'password',
  'secret',
  'apikey',
  'privatekey',
  'authorization',
  'rawpayload',
  'rawrequest',
  'rawresponse',
  'requestheaders',
  'errorstack'
]);
function assertNoForbiddenKeys(value, label) {
  const stack = [value];
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    for (const [key, next] of Object.entries(item)) {
      assert.equal(forbiddenKeys.has(key.toLowerCase()), false, `${label} exposed forbidden key ${key}`);
      stack.push(next);
    }
  }
}

const rawDevice = {
  id: 'device-1',
  tenantId: 'tenant-a',
  fieldId: 'field-a',
  code: 'soil-1',
  name: 'soil-1',
  type: 'SOIL_SENSOR',
  thingsboardDeviceId: 'tb-1',
  thingsboardAccessToken: 'must-not-leak',
  iotStatus: 'BOUND',
  bindingSource: 'MANUAL',
  mqttTopic: 'topic',
  online: true,
  currentStatus: { nested: { secret: 'must-not-leak', authorization: 'must-not-leak', ok: true } },
  lastReportedAt: new Date(),
  lastTelemetryAt: new Date(),
  remark: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  field: { id: 'field-a', tenantId: 'tenant-a', farmId: 'farm-a', name: 'field-a', apiKey: 'must-not-leak' }
};
const iotPrisma = {
  $transaction: async (ops) => Promise.all(ops),
  device: {
    findMany: async ({ where, select }) => {
      assert.equal(where.tenantId, 'tenant-a');
      assert.equal(select.thingsboardAccessToken, undefined);
      return [rawDevice];
    },
    count: async ({ where }) => {
      assert.equal(where.tenantId, 'tenant-a');
      return 1;
    },
    findFirst: async ({ where, select }) => {
      assert.equal(where.tenantId, 'tenant-a');
      assert.equal(select.thingsboardAccessToken, undefined);
      return rawDevice;
    }
  },
  field: { findMany: async () => [] }
};
const iotDeviceService = new IotDeviceService(
  iotPrisma,
  {},
  { create: async () => ({}) },
  { create: async () => ({}) },
  context
);
const deviceList = await iotDeviceService.findAll({ pageSize: 5 });
assertNoForbiddenKeys(deviceList, 'findAll');
const deviceDetail = await iotDeviceService.findOne('device-1');
assertNoForbiddenKeys(deviceDetail, 'findOne');
const deviceHealth = await iotDeviceService.getHealth('device-1');
assertNoForbiddenKeys(deviceHealth, 'getHealth');

let deadLetterFindManyWhere;
let deadLetterFindOneWhere;
const deadLetterServiceForRead = new IotWebhookDeadLetterService(
  {
    $transaction: async (ops) => Promise.all(ops),
    ioTWebhookDeadLetter: {
      findMany: async ({ where }) => {
        deadLetterFindManyWhere = where;
        return [{ id: 'dead-1', tenantId: 'tenant-a', rawPayload: { password: 'must-not-leak' }, errorStack: 'stack' }];
      },
      count: async ({ where }) => {
        assert.equal(where.tenantId, 'tenant-a');
        return 1;
      },
      findFirst: async ({ where }) => {
        deadLetterFindOneWhere = where;
        return { id: 'dead-1', tenantId: 'tenant-a', rawPayload: { password: 'must-not-leak' }, errorStack: 'stack' };
      }
    }
  },
  { create: async () => assert.fail('GET dead-letter reads must not write operation logs') },
  context
);
assertNoForbiddenKeys(await deadLetterServiceForRead.findAll({}), 'deadLetter.findAll');
assertNoForbiddenKeys(await deadLetterServiceForRead.findOne('dead-1'), 'deadLetter.findOne');
assert.equal(deadLetterFindManyWhere.tenantId, 'tenant-a');
assert.equal(deadLetterFindOneWhere.tenantId, 'tenant-a');

let syncAuditWriteCalls = 0;
let syncAuditFindManyWhere;
let syncAuditFindOneWhere;
const syncAuditPrisma = {
  $transaction: async (ops) => Promise.all(ops),
  ioTSyncAudit: {
    findMany: async ({ where }) => {
      syncAuditFindManyWhere = where;
      return [{ id: 'audit-1', tenantId: 'tenant-a', rawResult: { rawPayload: { secret: 'must-not-leak' } }, warnings: [] }];
    },
    count: async ({ where }) => {
      assert.equal(where.tenantId, 'tenant-a');
      return 1;
    },
    findFirst: async ({ where }) => {
      syncAuditFindOneWhere = where;
      return { id: 'audit-1', tenantId: 'tenant-a', source: 'thingsboard', syncType: 'devices', total: 1, created: 0, updated: 0, bound: 0, unbound: 0, startedAt: new Date(), finishedAt: new Date(), createdAt: new Date(), warnings: [], rawResult: { authorization: 'must-not-leak' } };
    },
    create: async () => {
      syncAuditWriteCalls += 1;
    },
    update: async () => {
      syncAuditWriteCalls += 1;
    },
    delete: async () => {
      syncAuditWriteCalls += 1;
    }
  }
};
const syncAuditService = new IotSyncAuditService(syncAuditPrisma, context);
assertNoForbiddenKeys(await syncAuditService.findAll({}), 'syncAudit.findAll');
assertNoForbiddenKeys(await syncAuditService.findOne('audit-1'), 'syncAudit.findOne');
assertNoForbiddenKeys(await syncAuditService.exportOne('audit-1'), 'syncAudit.exportOne');
assert.equal(syncAuditFindManyWhere.tenantId, 'tenant-a');
assert.equal(syncAuditFindOneWhere.tenantId, 'tenant-a');
assert.equal(syncAuditWriteCalls, 0);

let latestFarmSensorSelect;
let latestFarmSnapshotSelect;
let farmSummarySnapshotSelect;
const farmTelemetryPrisma = {
  deviceTelemetrySnapshot: {
    findFirst: async ({ where, select }) => {
      assert.equal(where.tenantId, 'tenant-a');
      latestFarmSnapshotSelect = select;
      return {
        id: 'snapshot-1',
        tenantId: 'tenant-a',
        farmId: 'farm-a',
        fieldId: 'field-a',
        deviceId: 'device-1',
        pressureKpa: 120,
        flowRateM3h: 3,
        rawPayload: { authorization: 'must-not-leak' },
        reportedAt: new Date()
      };
    },
    findMany: async ({ where, select }) => {
      assert.equal(where.tenantId, 'tenant-a');
      farmSummarySnapshotSelect = select;
      return [
        {
          id: 'snapshot-pressure',
          tenantId: 'tenant-a',
          farmId: 'farm-a',
          fieldId: 'field-a',
          deviceId: 'device-1',
        pressureKpa: 120,
        flowRateM3h: null,
        rawPayload: { secret: 'must-not-leak' },
        device: { thingsboardAccessToken: 'must-not-leak' },
        reportedAt: new Date(),
        qualityStatus: 'UNKNOWN',
        qualityScore: null
      },
      {
        id: 'snapshot-flow',
          tenantId: 'tenant-a',
          farmId: 'farm-a',
          fieldId: 'field-a',
          deviceId: 'device-2',
          pressureKpa: null,
          flowRateM3h: 7.2,
        rawPayload: { accessToken: 'must-not-leak' },
        latest: { device: { thingsboardAccessToken: 'must-not-leak' } },
        reportedAt: new Date(),
        qualityStatus: 'UNKNOWN',
        qualityScore: null
      }
      ];
    }
  },
  sensorRecord: {
    findFirst: async ({ where, select }) => {
      assert.equal(where.tenantId, 'tenant-a');
      latestFarmSensorSelect = select;
      return {
        id: 'sensor-1',
        tenantId: 'tenant-a',
        farmId: 'farm-a',
        fieldId: 'field-a',
        deviceId: 'device-1',
        type: 'SOIL_MOISTURE',
        value: 31,
        rawPayload: { deviceToken: 'must-not-leak' },
        reportedAt: new Date(),
        qualityStatus: 'UNKNOWN',
        qualityScore: null,
        device: {
          id: 'device-1',
          name: 'sensor',
          thingsboardAccessToken: 'must-not-leak',
          deviceToken: 'must-not-leak',
          currentStatus: { authorization: 'must-not-leak' }
        },
        field: { id: 'field-a', name: 'field-a' }
      };
    }
  }
};
const farmTelemetryService = new IotTelemetryNormalizerService(farmTelemetryPrisma, context);
const latestFarmTelemetry = await farmTelemetryService.latestForFarm('farm-a');
assert.equal(latestFarmSensorSelect.rawPayload, undefined);
assert.equal(latestFarmSensorSelect.device.select.thingsboardAccessToken, undefined);
assert.equal(latestFarmSnapshotSelect.rawPayload, undefined);
assertNoForbiddenKeys(latestFarmTelemetry, 'latestForFarm');
const farmSummary = await farmTelemetryService.farmSummary('farm-a');
assert.equal(farmSummarySnapshotSelect.rawPayload, undefined);
assertNoForbiddenKeys(farmSummary, 'farmSummary');
assert.equal(latestFarmTelemetry.sensorRecord.qualityStatus, 'UNKNOWN');
assert.equal(latestFarmTelemetry.sensorRecord.qualityScore, null);
assert.equal(farmSummary.quality.avgScore, null);
assert.equal(farmSummary.quality.warningCount, 2);

let connectCalls = 0;
let publishCalls = 0;
const originalConnect = MqttService.connectFactory;
MqttService.connectFactory = () => {
  connectCalls += 1;
  return {
    on: () => undefined,
    subscribe: () => undefined,
    publish: () => {
      publishCalls += 1;
    },
    end: () => undefined
  };
};
try {
  new MqttService({ get: (key) => ({ DEVICE_CONTROL_MODE: 'MOCK', DEVICE_CONTROL_DRY_RUN: 'true', MQTT_BROKER_URL: 'mqtt://127.0.0.1:1884' })[key] }, {}, {}).onModuleInit();
  assert.equal(connectCalls, 0);
  new MqttService({ get: (key) => ({ DEVICE_CONTROL_MODE: 'MQTT_DIRECT', DEVICE_CONTROL_DRY_RUN: 'true', MQTT_BROKER_URL: 'mqtt://127.0.0.1:1884' })[key] }, {}, {}).onModuleInit();
  assert.equal(connectCalls, 0);
  new MqttService({ get: (key) => ({ DEVICE_CONTROL_MODE: 'MQTT_DIRECT', DEVICE_CONTROL_DRY_RUN: 'false', MQTT_BROKER_URL: 'mqtt://127.0.0.1:1884' })[key] }, {}, {}).onModuleInit();
  assert.equal(connectCalls, 1);
  assert.equal(publishCalls, 0);
} finally {
  MqttService.connectFactory = originalConnect;
}

console.log('Stage 4 read-only IoT checks passed.');
console.log(JSON.stringify({ savedTelemetry, deadLetters, mqttCalls, rpcCalls, httpCalls, connectCalls, publishCalls, syncAuditWriteCalls }, null, 2));
