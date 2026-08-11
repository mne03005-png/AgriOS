import 'reflect-metadata';
import assert = require('node:assert/strict');
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ControlCommandArbiter, ControlPriority, bullMqPriority } from '@agrios/edge-core';
import { InMemoryQueueAdapter } from '../src/modules/action-queue/in-memory-queue.adapter';
import { BullMqQueueAdapter } from '../src/modules/action-queue/bullmq-queue.adapter';
import { SafetyController } from '../src/modules/safety/safety.controller';
import { MobileController } from '../src/modules/mobile/mobile.controller';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { TenantGuard } from '../src/common/tenant/tenant.guard';
import { PermissionsGuard } from '../src/common/permissions/permissions.guard';
import { SafetyService } from '../src/modules/safety/safety.service';
import { RequestContextService } from '../src/common/request-context.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const inContext = <T>(ctx: RequestContextService, callback: () => T | Promise<T>) => new Promise<T>((resolve, reject) => ctx.run({ tenantId: 'tenant-a', userId: 'user-a', role: 'FARM_MANAGER', requestId: 'req-a' }, () => Promise.resolve(callback()).then(resolve, reject)));

test('normal FIFO remains FIFO', () => { const q = new InMemoryQueueAdapter(); q.enqueue('a'); q.enqueue('b'); assert.deepEqual([q.next(), q.next()], ['a', 'b']); });
test('STOP jumps queued START', () => { const q = new InMemoryQueueAdapter(); q.enqueue('start', 0, ControlPriority.NORMAL_CONTROL); q.enqueue('stop', 0, ControlPriority.SAFETY_STOP); assert.deepEqual([q.next(), q.next()], ['stop', 'start']); });
test('Emergency Stop precedes STOP and START', () => { const q = new InMemoryQueueAdapter(); q.enqueue('start'); q.enqueue('stop', 0, ControlPriority.SAFETY_STOP); q.enqueue('estop', 0, ControlPriority.EMERGENCY_STOP); assert.deepEqual([q.next(), q.next(), q.next()], ['estop', 'stop', 'start']); });
test('equal STOP priority preserves FIFO', () => { const q = new InMemoryQueueAdapter(); q.enqueue('s1', 0, ControlPriority.SAFETY_STOP); q.enqueue('s2', 0, ControlPriority.SAFETY_STOP); assert.deepEqual([q.next(), q.next()], ['s1', 's2']); });
test('100-job backlog yields to Emergency Stop', () => { const q = new InMemoryQueueAdapter(); for (let i = 0; i < 100; i++) q.enqueue(`start-${i}`); q.enqueue('estop', 0, ControlPriority.EMERGENCY_STOP); assert.equal(q.next(), 'estop'); assert.equal(q.size(), 100); });
test('delayed job retains safety priority', async () => { const q = new InMemoryQueueAdapter(); q.enqueue('start'); q.enqueue('stop', 5, ControlPriority.SAFETY_STOP); await new Promise((r) => setTimeout(r, 15)); assert.equal(q.next(), 'stop'); q.close(); });
test('BullMQ mapping is lower-number-higher-priority', () => assert.deepEqual([bullMqPriority(ControlPriority.EMERGENCY_STOP), bullMqPriority(ControlPriority.SAFETY_STOP), bullMqPriority(ControlPriority.NORMAL_CONTROL)], [1, 10, 100]));
test('BullMQ enqueue carries mapped priority', async () => { let options: any; const adapter: any = Object.create(BullMqQueueAdapter.prototype); adapter.queue = { add: async (_n: string, _d: any, o: any) => { options = o; } }; await adapter.enqueue('e', 0, ControlPriority.EMERGENCY_STOP); assert.equal(options.priority, 1); });

for (const controller of [SafetyController, MobileController]) {
  const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
  test(`${controller.name} emergency path requires JWT`, () => assert.equal(guards.includes(JwtAuthGuard), true));
  test(`${controller.name} emergency path requires tenant guard`, () => assert.equal(guards.includes(TenantGuard), true));
  test(`${controller.name} emergency path requires permission guard`, () => assert.equal(guards.includes(PermissionsGuard), true));
}

function safetyFixture(options: { existing?: boolean; targets?: string[]; dispatchFails?: boolean; noFarm?: boolean } = {}) {
  const ctx = new RequestContextService(); const order: string[] = []; const dispatches: string[] = []; const logs: any[] = []; let active = false; let cancelled = 0;
  const prisma: any = {
    farm: { findFirst: async () => options.noFarm ? null : ({ id: 'farm-a' }) }, field: { findFirst: async () => ({ id: 'field-a' }) },
    safetyPolicy: {
      findFirst: async () => options.existing || active ? ({ id: 'latch-1' }) : null,
      create: async () => { order.push('latch'); active = true; return { id: 'latch-1' }; },
      updateMany: async () => { active = false; return { count: 1 }; }
    },
    actionPlan: { updateMany: async () => { order.push('invalidate'); cancelled++; return { count: 3 }; } },
    device: { findMany: async () => (options.targets ?? ['pump-1']).map((id) => ({ id })) }
  };
  const service = new SafetyService(prisma, ctx, { publish: () => undefined } as any, {
    send: async (id: string, command: any) => { order.push('dispatch'); dispatches.push(`${id}:${command.commandId}`); if (options.dispatchFails) throw new Error('PLC_OFFLINE'); return { ok: true, executed: true }; }
  } as any, { create: async (entry: any) => { order.push('audit'); logs.push(entry); return entry; } } as any);
  return { ctx, service, order, dispatches, logs, active: () => active, cancelled: () => cancelled };
}

test('authorized E-stop latches and audits before dispatch', async () => { const f = safetyFixture(); await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.deepEqual(f.order.slice(0, 4), ['latch', 'invalidate', 'audit', 'dispatch']); });
test('E-stop reaches fake DeviceControl emergency abstraction', async () => { const f = safetyFixture(); const r: any = await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(r.dispatch, 'DISPATCHED'); assert.match(f.dispatches[0], /^pump-1:emergency-stop:latch-1:pump-1$/); });
test('dispatch failure leaves latch active', async () => { const f = safetyFixture({ dispatchFails: true }); const r: any = await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(r.dispatch, 'DISPATCH_FAILED'); assert.equal(f.active(), true); });
test('PLC offline leaves latch active', async () => { const f = safetyFixture({ dispatchFails: true }); await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(f.active(), true); });
test('no target fails closed while latch remains active', async () => { const f = safetyFixture({ targets: [] }); const r: any = await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(r.dispatch, 'NO_CONTROLLABLE_TARGET'); assert.equal(f.active(), true); });
test('cross-tenant farm is rejected before latch', async () => { const f = safetyFixture({ noFarm: true }); await assert.rejects(() => inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-b' }))); assert.equal(f.order.length, 0); });
test('queued dangerous plans are permanently invalidated at latch', async () => { const f = safetyFixture(); await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(f.cancelled(), 1); });
test('duplicate E-stop returns existing latch without dispatch', async () => { const f = safetyFixture({ existing: true }); const r: any = await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(r.state, 'ALREADY_LATCHED'); assert.equal(f.dispatches.length, 0); });
test('E-stop audit contains latch and dispatch results', async () => { const f = safetyFixture(); await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a' })); assert.equal(f.logs[0].metadata.latchResult, 'LATCHED'); assert.equal(f.logs[f.logs.length - 1].metadata.dispatchResult, 'DISPATCHED'); });
test('explicit reset is audited and never auto-resumes', async () => { const f = safetyFixture({ existing: true }); const r: any = await inContext(f.ctx, () => f.service.emergencyStop({ farmId: 'farm-a', enabled: false })); assert.equal(r.autoResume, false); assert.equal(f.logs[0].action, 'EMERGENCY_STOP_RESET'); assert.equal(f.dispatches.length, 0); });

test('concurrent START and E-stop executes E-stop and blocks START', async () => { const a = new ControlCommandArbiter(); const executed: string[] = []; const start = a.submit('PUMP_ON', async (dispatch) => { if (dispatch) executed.push('START'); return dispatch; }); const stop = a.submit('EMERGENCY_STOP', async () => { executed.push('ESTOP'); return 'stop'; }); assert.equal(await start, false); assert.equal(await stop, 'stop'); assert.deepEqual(executed, ['ESTOP']); });
test('queued START backlog is blocked after latch', async () => { const a = new ControlCommandArbiter(); let unsafe = 0; const starts = Array.from({ length: 20 }, () => a.submit('VALVE_OPEN', async (dispatch) => { if (dispatch) unsafe++; return dispatch; })); await a.submit('EMERGENCY_STOP', async () => 1); await Promise.all(starts); assert.equal(unsafe, 0); });
test('STOP remains executable while E-stop latched', async () => { const a = new ControlCommandArbiter(); await a.submit('EMERGENCY_STOP', async () => 1); let stops = 0; await a.submit('PUMP_OFF', async () => ++stops); assert.equal(stops, 1); });
test('repeated E-stop burst has one fake physical execution', async () => { const a = new ControlCommandArbiter(); let executions = 0; const burst = Array.from({ length: 10 }, () => a.submit('EMERGENCY_STOP', async (dispatch) => dispatch ? ++executions : executions)); await Promise.all(burst); assert.equal(executions, 1); });
test('reset does not revive a stale queued START', async () => { const a = new ControlCommandArbiter(); let unsafe = 0; const start = a.submit('PUMP_ON', async (dispatch) => { if (dispatch) unsafe++; return dispatch; }); await a.submit({ action: 'EMERGENCY_STOP', commandId: 'estop-1' }, async () => 1); await a.submit({ action: 'RESET_EMERGENCY_STOP', commandId: 'reset-1', resetOfCommandId: 'estop-1' }, async () => 1); await start; assert.equal(unsafe, 0); });
test('restored Edge latch blocks START after restart', async () => { const a = new ControlCommandArbiter(); a.restoreEmergencyLatch('restored-estop'); let unsafe = 0; await a.submit('START_FERTIGATION', async (dispatch) => { if (dispatch) unsafe++; return dispatch; }); assert.equal(unsafe, 0); });
test('expired/reconnected stale START cannot pass active latch', async () => { const a = new ControlCommandArbiter(); a.restoreEmergencyLatch('restored-estop'); assert.equal(await a.submit('SET_PUMP_FREQUENCY', async (dispatch) => dispatch), false); });
test('STOP is independent of telemetry/ACK replay backlog', async () => { const a = new ControlCommandArbiter(); let stops = 0; await a.submit('PUMP_OFF', async () => ++stops); assert.equal(stops, 1); });

async function main() { let passed = 0; for (const item of tests) { try { await item.run(); passed++; console.log(`PASS ${item.name}`); } catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; } } console.log(`P0 EMERGENCY STOP PRIORITY: ${passed}/${tests.length} PASS`); if (passed !== tests.length) process.exitCode = 1; }
void main();
