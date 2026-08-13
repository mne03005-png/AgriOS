import 'reflect-metadata';
import assert = require('node:assert/strict');
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../src/common/request-context.service';
import { PermissionsGuard } from '../src/common/permissions/permissions.guard';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { TenantGuard } from '../src/common/tenant/tenant.guard';
import { IotController } from '../src/modules/iot/iot.controller';
import { IotDeviceService } from '../src/modules/iot/iot-device.service';
import { IotWebhookDeadLetterService } from '../src/modules/iot/iot-webhook-dead-letter.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const httpContext = (request: any, controller: any = IotController, handler: any = controller.prototype.getIotStatus) => ({
  switchToHttp: () => ({ getRequest: () => request }), getClass: () => controller, getHandler: () => handler
}) as any;
const guards = (target: any) => Reflect.getMetadata(GUARDS_METADATA, target) ?? [];
const hasGuard = (target: any, guard: any) => guards(target).includes(guard);
const inContext = <T>(ctx: RequestContextService, initial: any, callback: () => T | Promise<T>) =>
  new Promise<T>((resolve, reject) => ctx.run(initial, () => Promise.resolve(callback()).then(resolve, reject)));

const auditPrisma = { auditEvent: { create: async () => ({}) } } as any;
const permissionsGuard = () => new PermissionsGuard(new Reflector(), auditPrisma);

const ROLE_ROWS: [string, string][] = [
  ['FARMER', 'FARMER'],
  ['MANAGER', 'FARM_MANAGER'],
  ['INSTALLER', 'INSTALLER'],
  ['ENGINEER', 'MAINTAINER'],
  ['SUPER_ADMIN', 'PLATFORM_ADMIN']
];

// --- Section 3: guard/permission metadata now present on every remaining route this patch touches ---
const platformGatedHandlers: [string, any][] = [
  ['checkDevicesHealth', IotController.prototype.checkDevicesHealth],
  ['syncThingsBoardDevices', IotController.prototype.syncThingsBoardDevices]
];
const integrationReadHandlers: [string, any][] = [
  ['getThingsBoardAssets', IotController.prototype.getThingsBoardAssets],
  ['findSyncAudits', IotController.prototype.findSyncAudits],
  ['exportSyncAudit', IotController.prototype.exportSyncAudit],
  ['findSyncAudit', IotController.prototype.findSyncAudit]
];
const deadLetterReadHandlers: [string, any][] = [
  ['findWebhookDeadLetters', IotController.prototype.findWebhookDeadLetters],
  ['findDeadLetters', IotController.prototype.findDeadLetters],
  ['findDeadLetter', IotController.prototype.findDeadLetter],
  ['previewDeadLetter', IotController.prototype.previewDeadLetter],
  ['diffDeadLetter', IotController.prototype.diffDeadLetter]
];
const deadLetterWriteHandlers: [string, any][] = [
  ['batchRetryDeadLetters', IotController.prototype.batchRetryDeadLetters],
  ['batchMarkDeadLettersResolved', IotController.prototype.batchMarkDeadLettersResolved],
  ['markDeadLetterResolved', IotController.prototype.markDeadLetterResolved],
  ['retryDeadLetter', IotController.prototype.retryDeadLetter]
];
const telemetryReadHandlers: [string, any][] = [
  ['getLatestTelemetry', IotController.prototype.getLatestTelemetry],
  ['getTelemetryHistory', IotController.prototype.getTelemetryHistory],
  ['getLatestRealSensorTelemetry', IotController.prototype.getLatestRealSensorTelemetry],
  ['getFarmTelemetrySummary', IotController.prototype.getFarmTelemetrySummary],
  ['getFieldDevices', IotController.prototype.getFieldDevices],
  ['getFieldTelemetrySummary', IotController.prototype.getFieldTelemetrySummary]
];

for (const [name, handler] of [...platformGatedHandlers, ...integrationReadHandlers, ...deadLetterReadHandlers, ...deadLetterWriteHandlers, ...telemetryReadHandlers]) {
  test(`${name} carries PermissionsGuard in addition to JwtAuthGuard/TenantGuard`, () => {
    assert.equal(hasGuard(handler, JwtAuthGuard), true, `${name} lost JwtAuthGuard`);
    assert.equal(hasGuard(handler, TenantGuard), true, `${name} lost TenantGuard`);
    assert.equal(hasGuard(handler, PermissionsGuard), true, `${name} must now carry PermissionsGuard`);
  });
}

test('the ThingsBoard telemetry webhook remains guard-free (HMAC-secured, not JWT-secured) -- untouched by SEC-IOT-2', () => {
  assert.deepEqual(guards(IotController.prototype.receiveThingsBoardTelemetry), []);
});
test('getIotStatus is deliberately left ungated (static, non-sensitive config only, no tenant data)', () => {
  assert.equal(hasGuard(IotController.prototype.getIotStatus, PermissionsGuard), false);
});
test('SEC-IOT-1\'s own identity/binding cluster is unchanged by SEC-IOT-2 (not redesigned again)', () => {
  for (const handler of [IotController.prototype.bindPlot, IotController.prototype.confirmDeviceBindingCandidate, IotController.prototype.linkThingsBoardDevice, IotController.prototype.createDevice, IotController.prototype.updateDevice, IotController.prototype.unbindPlot]) {
    assert.equal(hasGuard(handler, PermissionsGuard), true, 'SEC-IOT-1 guard must remain in place');
  }
});

// --- Section 14 items 1-5: devices/check-health role matrix (PLATFORM_CONTEXT) ---
for (const [canonicalLabel, rawRole] of ROLE_ROWS) {
  const expectAllowed = canonicalLabel === 'SUPER_ADMIN';
  test(`checkDevicesHealth: ${canonicalLabel} (${rawRole}) is ${expectAllowed ? 'ALLOWED' : 'FORBIDDEN'}`, async () => {
    const request = { user: { userId: 'u', tenantId: 'tenant-a', role: rawRole }, requestId: 'r', url: '/iot/devices/check-health' };
    if (expectAllowed) {
      assert.equal(await permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.checkDevicesHealth)), true);
    } else {
      await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.checkDevicesHealth)), ForbiddenException);
    }
  });
}

// --- Section 14 items 9-13: thingsboard/sync-devices role matrix (PLATFORM_CONTEXT) ---
for (const [canonicalLabel, rawRole] of ROLE_ROWS) {
  const expectAllowed = canonicalLabel === 'SUPER_ADMIN';
  test(`syncThingsBoardDevices: ${canonicalLabel} (${rawRole}) is ${expectAllowed ? 'ALLOWED' : 'FORBIDDEN'}`, async () => {
    const request = { user: { userId: 'u', tenantId: 'tenant-a', role: rawRole }, requestId: 'r', url: '/iot/thingsboard/sync-devices' };
    if (expectAllowed) {
      assert.equal(await permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.syncThingsBoardDevices)), true);
    } else {
      await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.syncThingsBoardDevices)), ForbiddenException);
    }
  });
}
test('unauthorized direct API bypass: same-tenant FARMER cannot invoke POST /iot/thingsboard/sync-devices merely by holding a valid JWT', async () => {
  const request = { user: { userId: 'farmer-1', tenantId: 'tenant-a', role: 'FARMER' }, requestId: 'r', url: '/iot/thingsboard/sync-devices' };
  await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.syncThingsBoardDevices)), ForbiddenException);
});
test('unauthorized direct API bypass: same-tenant INSTALLER cannot invoke POST /iot/devices/check-health', async () => {
  const request = { user: { userId: 'installer-1', tenantId: 'tenant-a', role: 'INSTALLER' }, requestId: 'r', url: '/iot/devices/check-health' };
  await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.checkDevicesHealth)), ForbiddenException);
});

// --- Section 14 item 6-8: check-health authorized same-tenant behavior + platform-wide scope proof ---
// checkHealth() is platform-wide BY DESIGN (see the controller comment): it sweeps every device
// across every tenant. Once PLATFORM_CONTEXT gates who may call it at all, the underlying sweep
// legitimately spans tenants for an authorized platform caller -- this test proves that scope
// directly against the real Prisma update calls (not merely a returned status), matching the same
// "prove the write, don't just trust the error" discipline SEC-IOT-1 established.
test('checkHealth (platform-authorized call) sweeps devices across multiple tenants and reaches the real Prisma update for each stale one', async () => {
  const updates: any[] = [];
  const devices = [
    { id: 'device-a', tenantId: 'tenant-a', iotStatus: 'ONLINE', online: true, lastTelemetryAt: new Date(Date.now() - 60 * 60 * 1000), lastReportedAt: null },
    { id: 'device-b', tenantId: 'tenant-b', iotStatus: 'ONLINE', online: true, lastTelemetryAt: new Date(Date.now() - 60 * 60 * 1000), lastReportedAt: null }
  ];
  const prisma: any = {
    device: {
      findMany: async () => devices,
      update: async ({ where, data }: any) => {
        updates.push({ where, data });
        return { ...devices.find((d) => d.id === where.id), ...data };
      }
    }
  };
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, async () => {
    const service = new IotDeviceService(prisma, {} as any, { create: async () => ({}) } as any, {} as any, ctx);
    const result = await service.checkHealth();
    assert.equal(result.checked, 2);
    assert.equal(updates.length, 2, 'both tenant-a and tenant-b devices must have been actually updated (platform-wide sweep proven at the write, not merely the return value)');
    assert.deepEqual(updates.map((u) => u.where.id).sort(), ['device-a', 'device-b']);
  });
});

// --- Section 14 items 14-16: thingsboard sync -- honest documentation of the intentionally
// deferred cross-tenant collision scope (see final report §F/§H: fixing this requires redesigning
// how a ThingsBoard identity maps to an AgriOS tenant, which is out of SEC-IOT-2's scope). What
// SEC-IOT-2 DOES guarantee is that only a PLATFORM_CONTEXT-authorized caller can reach this code
// path at all -- proven above. This test documents the current, unmodified device-matching
// behavior honestly rather than asserting a protection that was not implemented.
test('syncThingsBoardDevices device-matching remains unmodified by SEC-IOT-2 (documented, not silently changed)', async () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/modules/iot/iot-device.service.ts'), 'utf8');
  assert.match(source, /findFirst\(\{ where: \{ thingsboardDeviceId \} \}\)/, 'sync device lookup is unchanged -- still a global (not tenant-filtered) match, exactly as SEC-IOT-1 found and SEC-IOT-2 left in place pending an architecture decision');
});

// --- Section 9: webhook dead-letter WRITE authorization + tenant isolation ---
for (const routeName of ['retryDeadLetter', 'markDeadLetterResolved'] as const) {
  const handler = (IotController.prototype as any)[routeName];
  for (const [canonicalLabel, rawRole] of ROLE_ROWS) {
    const expectAllowed = canonicalLabel === 'MANAGER' || canonicalLabel === 'ENGINEER' || canonicalLabel === 'SUPER_ADMIN';
    test(`${routeName}: ${canonicalLabel} (${rawRole}) is ${expectAllowed ? 'ALLOWED' : 'FORBIDDEN'}`, async () => {
      const request = { user: { userId: 'u', tenantId: 'tenant-a', role: rawRole }, requestId: 'r', url: `/iot/webhook-dead-letters/dl-1/${routeName}` };
      if (expectAllowed) {
        assert.equal(await permissionsGuard().canActivate(httpContext(request, IotController, handler)), true);
      } else {
        await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, handler)), ForbiddenException);
      }
    });
  }
}

function deadLetterServiceFixture(tenantIdOfRecord: string) {
  let updateCalls = 0;
  const record = { id: 'dl-1', tenantId: tenantIdOfRecord, status: 'PENDING', retryCount: 0, rawPayload: { deviceName: 'd1' }, resolvedAt: null };
  const prisma: any = {
    ioTWebhookDeadLetter: {
      findFirst: async ({ where }: any) => (where.tenantId === undefined || where.tenantId === tenantIdOfRecord ? record : null),
      findMany: async ({ where }: any) => (where.tenantId === undefined || where.tenantId === tenantIdOfRecord ? [record] : []),
      update: async ({ data }: any) => {
        updateCalls += 1;
        return { ...record, ...data };
      }
    }
  };
  const service = new IotWebhookDeadLetterService(prisma, { create: async () => ({}) } as any, new RequestContextService());
  return { service, updateCalls: () => updateCalls };
}

test('tenant isolation: markResolved on a tenant-a dead letter is rejected when caller is scoped to tenant-b, write never reached', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deadLetterServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.markResolved('dl-1'), NotFoundException);
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('tenant isolation: markResolved on a tenant-a dead letter SUCCEEDS when caller is scoped to tenant-a', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, async () => {
    const fixture = deadLetterServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await fixture.service.markResolved('dl-1');
    assert.equal(fixture.updateCalls(), 1);
  });
});
test('tenant isolation: retry on a tenant-a dead letter is rejected when caller is scoped to tenant-b, write never reached', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deadLetterServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.retry('dl-1', async () => ({ accepted: true })), NotFoundException);
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('tenant isolation: batchRetry with no explicit ids only discovers this tenant\'s own PENDING dead letters (findPendingIds is tenant-scoped)', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deadLetterServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    const result = await fixture.service.batchRetry({}, async () => ({ accepted: true }));
    assert.equal(result.total, 0, 'a tenant-b caller must not discover or retry a tenant-a pending dead letter');
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('platform admin context still bypasses the dead-letter tenant filter (unchanged, pre-existing tenantWhere() semantics)', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, async () => {
    const fixture = deadLetterServiceFixture('tenant-b');
    (fixture.service as any).requestContext = ctx;
    await fixture.service.markResolved('dl-1');
    assert.equal(fixture.updateCalls(), 1, 'platform admin cross-tenant dead-letter access must remain unchanged');
  });
});

// --- Section 10: external ThingsBoard telemetry webhook -- prove HMAC still fail-closed, untouched ---
test('external telemetry webhook: missing signature/timestamp is rejected (HMAC auth unmodified by SEC-IOT-2)', async () => {
  const { ThingsBoardWebhookService } = require('../src/modules/iot/thingsboard-webhook.service');
  const webhook = new ThingsBoardWebhookService(
    {} as any,
    { resolvePlotBinding: async () => ({ device: null, plotId: null, farmId: null }), recordTelemetryAudit: async () => ({}) } as any,
    { evaluate: () => ({ action: 'NORMAL', message: 'ok' }) } as any,
    { evaluate: async () => ({}) } as any,
    { create: async () => ({}) } as any,
    { normalize: () => ({}), assessQuality: () => ({ status: 'GOOD' }) } as any,
    { create: async () => ({}) } as any
  );
  process.env.THINGSBOARD_WEBHOOK_SECRET = 'test-secret';
  await assert.rejects(() => webhook.handleTelemetry('test-secret', { deviceName: 'd1', eventId: 'e1', ts: Date.now(), telemetry: {} }, {}), /Invalid webhook credentials/);
});

async function main() {
  let passed = 0;
  for (const item of tests) {
    try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; }
  }
  console.log(`SEC-IOT-2 PRIVILEGED OPERATIONS: ${passed}/${tests.length} PASS`);
  if (passed !== tests.length) process.exitCode = 1;
}

void main();
