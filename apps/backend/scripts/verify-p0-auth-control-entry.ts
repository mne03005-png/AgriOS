import 'reflect-metadata';
import assert = require('node:assert/strict');
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../src/common/request-context.service';
import { trustedRequestContextMiddleware } from '../src/common/trusted-request-context.middleware';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { TenantGuard } from '../src/common/tenant/tenant.guard';
import { PermissionsGuard } from '../src/common/permissions/permissions.guard';
import { TenantController } from '../src/modules/tenant/tenant.controller';
import { ApprovalController } from '../src/modules/approval/approval.controller';
import { ApprovalsAliasController } from '../src/modules/approval/approvals-alias.controller';
import { DecisionEngineController } from '../src/modules/decision-engine/decision-engine.controller';
import { ExecutionController } from '../src/modules/execution/execution.controller';
import { DecisionController } from '../src/modules/decision/decision.controller';
import { MqttController } from '../src/modules/mqtt/mqtt.controller';
import { DeviceController } from '../src/modules/device/device.controller';
import { DeviceCommandController } from '../src/modules/device-command/device-command.controller';
import { ApprovalService } from '../src/modules/approval/approval.service';
import { TenantService } from '../src/modules/tenant/tenant.service';
import { ActionExecutorService } from '../src/modules/decision-engine/action-executor.service';
import { ActionPlanExecutionMode } from '../src/modules/decision-engine/dto/execute-action-plan.dto';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const httpContext = (request: any, controller: any = TenantController, handler: any = controller.prototype.findAll) => ({
  switchToHttp: () => ({ getRequest: () => request }), getClass: () => controller, getHandler: () => handler
}) as any;
const guards = (controller: any) => Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
const hasGuard = (controller: any, guard: any) => guards(controller).includes(guard);
const inContext = <T>(ctx: RequestContextService, initial: any, callback: () => T | Promise<T>) =>
  new Promise<T>((resolve, reject) => ctx.run(initial, () => Promise.resolve(callback()).then(resolve, reject)));

for (const [name, controller] of [
  ['TenantController', TenantController], ['ApprovalController', ApprovalController], ['ApprovalsAliasController', ApprovalsAliasController],
  ['DecisionEngineController', DecisionEngineController], ['ExecutionController', ExecutionController], ['DecisionController', DecisionController],
  ['MqttController', MqttController], ['DeviceController', DeviceController], ['DeviceCommandController', DeviceCommandController]
] as const) {
  test(`${name} requires JWT authentication`, () => assert.equal(hasGuard(controller, JwtAuthGuard), true));
  test(`${name} requires tenant isolation`, () => assert.equal(hasGuard(controller, TenantGuard), true));
}

test('forged JWT payload cannot populate tenant or role context', async () => {
  const ctx = new RequestContextService();
  const forged = 'eyJhbGciOiJub25lIn0.eyJ0ZW5hbnRJZCI6InRlbmFudC1iIiwicm9sZSI6IlBMQVRGT1JNX0FETUlOIn0.invalid';
  await new Promise<void>((resolve, reject) => trustedRequestContextMiddleware(ctx)(
    { requestId: 'req-forged', headers: { authorization: `Bearer ${forged}`, 'x-tenant-id': 'tenant-b' } } as any,
    {},
    () => {
      try { assert.equal(ctx.getTenantId(), undefined); assert.equal(ctx.getRole(), undefined); resolve(); } catch (error) { reject(error); }
    }
  ));
});

test('forged JWT signature is rejected by JwtAuthGuard', async () => {
  const ctx = new RequestContextService();
  const guard = new JwtAuthGuard({ verify: () => { throw new Error('invalid signature'); } } as any, {} as any, ctx);
  await assert.rejects(() => guard.canActivate(httpContext({ headers: { authorization: 'Bearer forged.jwt.value' } })), Error);
});

test('missing JWT is rejected as unauthorized', async () => {
  const guard = new JwtAuthGuard({} as any, {} as any, new RequestContextService());
  await assert.rejects(() => guard.canActivate(httpContext({ headers: {} })), UnauthorizedException);
});

test('insufficient permission cannot execute an action plan', async () => {
  const guard = new PermissionsGuard(new Reflector(), { auditEvent: { create: async () => ({}) } } as any);
  const request = { user: { userId: 'farmer', tenantId: 'tenant-a', role: 'FARMER' }, requestId: 'r', url: '/decision-engine/action-plans/plan-a/execute' };
  await assert.rejects(
    () => guard.canActivate(httpContext(request, DecisionEngineController, DecisionEngineController.prototype.executeActionPlan)),
    ForbiddenException
  );
});

test('platform admin has the explicit action-plan execution permission', async () => {
  const guard = new PermissionsGuard(new Reflector(), { auditEvent: { create: async () => ({}) } } as any);
  const request = { user: { userId: 'admin', tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, requestId: 'r', url: '/decision-engine/action-plans/plan-a/execute' };
  assert.equal(await guard.canActivate(httpContext(request, DecisionEngineController, DecisionEngineController.prototype.executeActionPlan)), true);
});

test('verified principal becomes the only trusted identity', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { requestId: 'verified' }, async () => {
    const guard = new JwtAuthGuard({ verify: () => ({ userId: 'user-a', tokenVersion: 1 }) } as any, {
      user: { findUnique: async () => ({ id: 'user-a', tenantId: 'tenant-a', farmId: 'farm-a', role: 'FARM_MANAGER', status: 'ACTIVE', tokenVersion: 1 }) }
    } as any, ctx);
    assert.equal(await guard.canActivate(httpContext({ headers: { authorization: 'Bearer signed' } })), true);
    assert.equal(ctx.getTenantId(), 'tenant-a'); assert.equal(ctx.getRole(), 'FARM_MANAGER');
  });
});

test('normal user cannot switch tenant using x-tenant-id', async () => {
  const ctx = new RequestContextService();
  const prisma = { auditEvent: { create: async () => ({}) }, farm: { findFirst: async () => null } } as any;
  const guard = new TenantGuard(prisma, ctx);
  await assert.rejects(() => guard.canActivate(httpContext({ user: { tenantId: 'a', role: 'FARM_MANAGER' }, headers: { 'x-tenant-id': 'b' }, query: {}, body: {}, params: {} })), ForbiddenException);
});

test('platform cross-tenant requires explicit platform context', async () => {
  const ctx = new RequestContextService();
  const guard = new TenantGuard({ auditEvent: { create: async () => ({}) } } as any, ctx);
  await assert.rejects(() => guard.canActivate(httpContext({ user: { tenantId: 'a', role: 'PLATFORM_ADMIN' }, headers: { 'x-tenant-id': 'b' }, query: {}, body: {}, params: {} })), ForbiddenException);
});

test('authorized platform context may select a tenant and is audited', async () => {
  const ctx = new RequestContextService(); let audits = 0;
  await inContext(ctx, { tenantId: 'a', role: 'PLATFORM_ADMIN' }, async () => {
    const guard = new TenantGuard({ auditEvent: { create: async () => { audits++; return {}; } } } as any, ctx);
    assert.equal(await guard.canActivate(httpContext({ user: { userId: 'u', tenantId: 'a', role: 'PLATFORM_ADMIN' }, requestId: 'r', headers: { 'x-tenant-id': 'b', 'x-platform-context': 'true' }, query: {}, body: {}, params: {} })), true);
    assert.equal(ctx.getTenantId(), 'b'); assert.equal(audits, 1);
  });
});

test('normal tenant user cannot list all tenants at service layer', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'a', role: 'FARM_MANAGER' }, async () => assert.rejects(() => new TenantService({} as any, ctx).findAll(), ForbiddenException));
});

test('normal tenant user cannot patch another tenant at service layer', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'a', role: 'FARM_MANAGER' }, async () => assert.rejects(() => new TenantService({} as any, ctx).update('b', {}), ForbiddenException));
});

for (const operation of ['approve', 'reject'] as const) test(`tenant A cannot ${operation} tenant B approval`, async () => {
  const ctx = new RequestContextService(); let where: any;
  await inContext(ctx, { tenantId: 'a', userId: 'u' }, async () => {
    const service = new ApprovalService({ approvalRequest: { findFirst: async (query: any) => { where = query.where; return null; } } } as any, ctx, {} as any);
    await assert.rejects(() => operation === 'approve' ? service.approve('approval-b') : service.reject('approval-b'), Error);
    assert.deepEqual(where, { id: 'approval-b', tenantId: 'a' });
  });
});

const executorFixture = (ctx: RequestContextService, safetyResult: any) => {
  let sends = 0; let logs: any[] = [];
  const plan = { id: 'plan-a', tenantId: 'tenant-a', fieldId: 'field-a', decisionId: 'decision-a', status: 'READY', safety: {}, actions: [{ type: 'NOOP' }], decision: { farmId: 'farm-a' } };
  const prisma: any = {
    actionPlan: { findFirst: async ({ where }: any) => where.tenantId === 'tenant-a' ? plan : null, update: async ({ data }: any) => ({ ...plan, ...data, executions: [] }) },
    decisionRecord: { update: async () => ({}) }
  };
  const service = new ActionExecutorService(prisma, { send: async () => { sends++; } } as any, { linkActionPlanResult: async () => ({}) } as any,
    { create: async (entry: any) => { logs.push(entry); return entry; } } as any, { checkActionPlan: async () => safetyResult } as any, ctx);
  return { service, sends: () => sends, logs };
};

test('tenant A cannot execute tenant B action plan', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-b', role: 'PLATFORM_ADMIN' }, async () => {
    const { service } = executorFixture(ctx, { allowed: true, status: 'PASS', hardBlocks: [], softBlocks: [] });
    await assert.rejects(() => service.executePlan('plan-a'), Error);
  });
});

test('legacy force=true cannot bypass safety', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, async () => {
    const fixture = executorFixture(ctx, { allowed: false, status: 'BLOCKED', hardBlocks: ['FAULT'], softBlocks: [] });
    await assert.rejects(() => fixture.service.executePlan('plan-a', true as any), BadRequestException); assert.equal(fixture.sends(), 0);
  });
});

test('authorized override requires a nonblank reason', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, async () => {
    const { service } = executorFixture(ctx, { allowed: false, status: 'PENDING_APPROVAL', hardBlocks: [], softBlocks: ['POLICY'] });
    await assert.rejects(() => service.executePlan('plan-a', { mode: ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE }), BadRequestException);
  });
});

test('insufficient permission cannot override soft policy', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, async () => {
    const { service } = executorFixture(ctx, { allowed: false, status: 'PENDING_APPROVAL', hardBlocks: [], softBlocks: ['POLICY'] });
    await assert.rejects(() => service.executePlan('plan-a', { mode: ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE, overrideReason: 'approved maintenance' }), ForbiddenException);
  });
});

test('authorized soft-policy override produces an audit record', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', userId: 'admin', role: 'PLATFORM_ADMIN', requestId: 'req-1' }, async () => {
    const fixture = executorFixture(ctx, { allowed: false, status: 'PENDING_APPROVAL', hardBlocks: [], softBlocks: ['POLICY'] });
    await fixture.service.executePlan('plan-a', { mode: ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE, overrideReason: 'approved maintenance' });
    assert.equal(fixture.logs.length, 1); assert.equal(fixture.logs[0].metadata.override.userId, 'admin');
  });
});

test('Emergency Stop remains absolute even for elevated override', async () => {
  const ctx = new RequestContextService();
  await inContext(ctx, { tenantId: 'tenant-a', role: 'PLATFORM_ADMIN' }, async () => {
    const fixture = executorFixture(ctx, { allowed: false, status: 'BLOCKED', hardBlocks: ['EMERGENCY_STOP_ENABLED'], softBlocks: [] });
    await assert.rejects(() => fixture.service.executePlan('plan-a', { mode: ActionPlanExecutionMode.AUTHORIZED_POLICY_OVERRIDE, overrideReason: 'test only' }), BadRequestException);
    assert.equal(fixture.sends(), 0);
  });
});

async function main() {
  let passed = 0;
  for (const item of tests) {
    try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; }
  }
  console.log(`P0 AUTH CONTROL ENTRY: ${passed}/${tests.length} PASS`);
  if (passed !== tests.length) process.exitCode = 1;
}

void main();
