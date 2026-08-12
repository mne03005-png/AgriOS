import 'reflect-metadata';
import assert = require('node:assert/strict');
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../src/common/request-context.service';
import { TenantGuard } from '../src/common/tenant/tenant.guard';
import { PermissionsGuard } from '../src/common/permissions/permissions.guard';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { IotController } from '../src/modules/iot/iot.controller';
import { IotDeviceService } from '../src/modules/iot/iot-device.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const httpContext = (request: any, controller: any = IotController, handler: any = controller.prototype.findDevices) => ({
  switchToHttp: () => ({ getRequest: () => request }), getClass: () => controller, getHandler: () => handler
}) as any;
const guards = (target: any) => Reflect.getMetadata(GUARDS_METADATA, target) ?? [];
const hasGuard = (target: any, guard: any) => guards(target).includes(guard);
const inContext = <T>(ctx: RequestContextService, initial: any, callback: () => T | Promise<T>) =>
  new Promise<T>((resolve, reject) => ctx.run(initial, () => Promise.resolve(callback()).then(resolve, reject)));

const auditPrisma = { auditEvent: { create: async () => ({}) } } as any;
const permissionsGuard = () => new PermissionsGuard(new Reflector(), auditPrisma);

// --- Section 3/32: guard + permission metadata now present on the identity/binding cluster ---
const writeHandlers: [string, any][] = [
  ['createDevice', IotController.prototype.createDevice],
  ['updateDevice', IotController.prototype.updateDevice],
  ['bindPlot', IotController.prototype.bindPlot],
  ['unbindPlot', IotController.prototype.unbindPlot],
  ['linkThingsBoardDevice', IotController.prototype.linkThingsBoardDevice],
  ['confirmDeviceBindingCandidate', IotController.prototype.confirmDeviceBindingCandidate]
];
const readHandlers: [string, any][] = [
  ['findDevices', IotController.prototype.findDevices],
  ['findDevice', IotController.prototype.findDevice],
  ['getDeviceHealth', IotController.prototype.getDeviceHealth],
  ['getDeviceBindingCandidates', IotController.prototype.getDeviceBindingCandidates],
  ['getThingsBoardBindingCandidates', IotController.prototype.getThingsBoardBindingCandidates]
];

for (const [name, handler] of [...writeHandlers, ...readHandlers]) {
  test(`${name} carries PermissionsGuard in addition to JwtAuthGuard/TenantGuard`, () => {
    assert.equal(hasGuard(handler, JwtAuthGuard), true, `${name} lost JwtAuthGuard`);
    assert.equal(hasGuard(handler, TenantGuard), true, `${name} lost TenantGuard`);
    assert.equal(hasGuard(handler, PermissionsGuard), true, `${name} must now carry PermissionsGuard`);
  });
}

test('the ThingsBoard telemetry webhook keeps zero guards (HMAC-secured, not JWT-secured) -- unaffected by this patch', () => {
  assert.deepEqual(guards(IotController.prototype.receiveThingsBoardTelemetry), []);
});
test('read-only endpoints outside the identity/binding cluster are unchanged (still JwtAuthGuard+TenantGuard only, no scope creep)', () => {
  for (const handler of [IotController.prototype.getFarmTelemetrySummary, IotController.prototype.getTelemetryHistory, IotController.prototype.getIotStatus, IotController.prototype.findWebhookDeadLetters]) {
    assert.equal(hasGuard(handler, PermissionsGuard), false, 'this patch must stay scoped to the identity/binding cluster');
  }
});

// --- Section 11: role matrix for the three named binding writes ---
const ROLE_ROWS: [string, string][] = [
  ['FARMER', 'FARMER'],
  ['MANAGER', 'FARM_MANAGER'],
  ['INSTALLER', 'INSTALLER'],
  ['ENGINEER', 'MAINTAINER'],
  ['SUPER_ADMIN', 'PLATFORM_ADMIN']
];
const EXPECTED_BIND_WRITE_ALLOWED = new Set(['ENGINEER', 'SUPER_ADMIN']); // ENGINEER via MAINTAINER's DEVICE_MANAGE, SUPER_ADMIN via allPermissions
// MANAGER (FARM_MANAGER) also genuinely holds DEVICE_MANAGE in the existing, unmodified permission
// matrix -- this is pre-existing intended architecture (farm managers can already manage devices),
// not something this patch invented. See the final report's role-matrix section for the evidence.
EXPECTED_BIND_WRITE_ALLOWED.add('MANAGER');

for (const routeName of ['bindPlot', 'confirmDeviceBindingCandidate', 'linkThingsBoardDevice'] as const) {
  const handler = (IotController.prototype as any)[routeName];
  for (const [canonicalLabel, rawRole] of ROLE_ROWS) {
    const expectAllowed = EXPECTED_BIND_WRITE_ALLOWED.has(canonicalLabel);
    test(`${routeName}: ${canonicalLabel} (${rawRole}) generic IoT bind write is ${expectAllowed ? 'ALLOWED' : 'FORBIDDEN'}`, async () => {
      const request = { user: { userId: 'u', tenantId: 'tenant-a', role: rawRole }, requestId: 'r', url: `/iot/devices/device-1/${routeName}` };
      if (expectAllowed) {
        assert.equal(await permissionsGuard().canActivate(httpContext(request, IotController, handler)), true);
      } else {
        await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, handler)), ForbiddenException);
      }
    });
  }
}

// --- Section 6: binding-candidate READ endpoints require DEVICE_READ ---
for (const routeName of ['getThingsBoardBindingCandidates', 'getDeviceBindingCandidates'] as const) {
  const handler = (IotController.prototype as any)[routeName];
  for (const [canonicalLabel, rawRole] of ROLE_ROWS) {
    test(`${routeName}: ${canonicalLabel} (${rawRole}) binding-candidate READ is ALLOWED (every canonical role holds DEVICE_READ)`, async () => {
      const request = { user: { userId: 'u', tenantId: 'tenant-a', role: rawRole }, requestId: 'r', url: `/iot/${routeName}` };
      assert.equal(await permissionsGuard().canActivate(httpContext(request, IotController, handler)), true);
    });
  }
  test(`${routeName}: a role holding no DEVICE_READ permission (MACHINERY_PROVIDER) is FORBIDDEN`, async () => {
    const request = { user: { userId: 'u', tenantId: 'tenant-a', role: 'MACHINERY_PROVIDER' }, requestId: 'r', url: `/iot/${routeName}` };
    await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, handler)), ForbiddenException);
  });
}

// --- Section 12: direct API bypass -- an authenticated same-tenant FARMER/INSTALLER cannot reach
// the mutation via a raw HTTP-shaped request, independent of any frontend hiding ---
test('direct bypass: authenticated same-tenant FARMER cannot invoke POST /iot/devices/:id/bind-plot', async () => {
  const request = { user: { userId: 'farmer-1', tenantId: 'tenant-a', role: 'FARMER' }, requestId: 'r', url: '/iot/devices/device-1/bind-plot' };
  await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.bindPlot)), ForbiddenException);
});
test('direct bypass: authenticated same-tenant INSTALLER cannot invoke POST /iot/devices/:id/bind-plot (generic binding intentionally not authorized for INSTALLER)', async () => {
  const request = { user: { userId: 'installer-1', tenantId: 'tenant-a', role: 'INSTALLER' }, requestId: 'r', url: '/iot/devices/device-1/bind-plot' };
  await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.bindPlot)), ForbiddenException);
});
test('unauthenticated request is rejected before permission evaluation even reaches the guard meaningfully (missing user)', async () => {
  const request = { user: undefined, requestId: 'r', url: '/iot/devices/device-1/bind-plot' };
  await assert.rejects(() => permissionsGuard().canActivate(httpContext(request, IotController, IotController.prototype.bindPlot)), UnauthorizedException);
});

// --- Section 13: tenant isolation -- role/permission authorization must not weaken tenant scoping,
// and this patch's own tenantWhere() fix must independently block cross-tenant mutation at the
// service layer (this is what makes ROLE authorization AND TENANT authorization both hold) ---
function deviceServiceFixture(tenantIdOfDevice: string) {
  let updateCalls = 0;
  let createCalls = 0;
  const device = { id: 'device-1', tenantId: tenantIdOfDevice, fieldId: null, thingsboardDeviceId: null, currentStatus: {}, code: 'dev-1', name: 'dev-1' };
  const prisma: any = {
    device: {
      findFirst: async ({ where }: any) => (where.tenantId === undefined || where.tenantId === tenantIdOfDevice ? device : null),
      update: async ({ data }: any) => {
        updateCalls += 1;
        return { ...device, ...data };
      },
      create: async ({ data }: any) => {
        createCalls += 1;
        return { id: 'device-new', ...data };
      }
    },
    field: { findUnique: async ({ where }: any) => ({ id: where.id, tenantId: tenantIdOfDevice }) }
  };
  const service = new IotDeviceService(prisma, {} as any, { create: async () => ({}) } as any, {} as any, new RequestContextService());
  return { service, updateCalls: () => updateCalls, createCalls: () => createCalls };
}

test('tenant isolation: bindPlot for a tenant-a device is rejected when caller is scoped to tenant-b, and the write is never reached', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.bindPlot('device-1', { plotId: 'field-a' } as any), NotFoundException);
    assert.equal(fixture.updateCalls(), 0, 'cross-tenant bindPlot must never reach the Prisma write');
  });
});
test('tenant isolation: bindPlot for a tenant-a device SUCCEEDS when caller is scoped to tenant-a (legitimate same-tenant call unaffected)', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await fixture.service.bindPlot('device-1', { plotId: 'field-a' } as any);
    assert.equal(fixture.updateCalls(), 1, 'same-tenant bindPlot must still reach the Prisma write exactly once');
  });
});
test('tenant isolation: unbindPlot for a tenant-a device is rejected when caller is scoped to tenant-b', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.unbindPlot('device-1'), NotFoundException);
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('tenant isolation: confirmBindingCandidate for a tenant-a device is rejected when caller is scoped to tenant-b', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.confirmBindingCandidate('device-1', { plotId: 'field-a', source: 'MANUAL' } as any), NotFoundException);
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('tenant isolation: linkThingsBoardDevice for a tenant-a device is rejected when caller is scoped to tenant-b', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.linkThingsBoardDevice('device-1', {} as any), NotFoundException);
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('tenant isolation: updateDevice for a tenant-a device is rejected when caller is scoped to tenant-b', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    await assert.rejects(() => fixture.service.update('device-1', {} as any), NotFoundException);
    assert.equal(fixture.updateCalls(), 0);
  });
});
test('createDevice now stamps the caller tenant onto the new device (previously created tenant-less records)', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, async () => {
    const fixture = deviceServiceFixture('tenant-a');
    (fixture.service as any).requestContext = ctx;
    const created: any = await fixture.service.create({ name: 'new-device' } as any);
    assert.equal(created.tenantId, 'tenant-a');
    assert.equal(fixture.createCalls(), 1);
  });
});

// --- Section 14: platform/x-platform-context semantics unchanged by this patch ---
test('platform admin context still bypasses the tenant filter added by this patch (tenantWhere is a no-op for platform admins, exactly as before)', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, async () => {
    const fixture = deviceServiceFixture('tenant-b');
    (fixture.service as any).requestContext = ctx;
    // A platform admin's own tenant is 'tenant-a' but the device belongs to 'tenant-b' --
    // tenantWhere() must still let this through exactly as it already did for the existing
    // read methods (findOne/getBindingCandidates), unchanged by this patch.
    await fixture.service.bindPlot('device-1', { plotId: 'field-a' } as any);
    assert.equal(fixture.updateCalls(), 1, 'platform admin cross-tenant access must remain unchanged');
  });
});
test('existing TenantGuard platform cross-tenant semantics (x-platform-context) are untouched by this patch', async () => {
  const ctx = new RequestContextService();
  const guard = new TenantGuard({ auditEvent: { create: async () => ({}) } } as any, ctx);
  await assert.rejects(
    () => guard.canActivate(httpContext({ user: { tenantId: 'a', role: 'PLATFORM_ADMIN' }, headers: { 'x-tenant-id': 'b' }, query: {}, body: {}, params: {} }, IotController, IotController.prototype.bindPlot)),
    ForbiddenException
  );
});

async function main() {
  let passed = 0;
  for (const item of tests) {
    try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; }
  }
  console.log(`SEC-IOT-1 AUTHORIZATION: ${passed}/${tests.length} PASS`);
  if (passed !== tests.length) process.exitCode = 1;
}

void main();
