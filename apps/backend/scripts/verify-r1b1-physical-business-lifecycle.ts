import 'reflect-metadata';
import assert = require('node:assert/strict');
import { RequestContextService } from '../src/common/request-context.service';
import { ActionQueueService } from '../src/modules/action-queue/action-queue.service';
import { ExecutionResultLinkerService } from '../src/modules/execution/execution-result-linker.service';
import { ExecutionService } from '../src/modules/execution/execution.service';
import { MobileService } from '../src/modules/mobile/mobile.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const runIn = <T>(ctx: RequestContextService, value: any, fn: () => T | Promise<T>) => new Promise<T>((resolve, reject) => ctx.run(value, () => Promise.resolve(fn()).then(resolve, reject)));

function lifecycleFixture(status = 'PHYSICALLY_CONFIRMED') {
  const usages: any[] = [];
  const events: any[] = [];
  const plan: any = {
    id: 'plan-execution-a', tenantId: 'tenant-a', fieldId: 'field-a', status: status === 'PHYSICALLY_CONFIRMED' ? 'EXECUTED' : status,
    decision: { metadata: { source: 'EXECUTION_SERVICE' }, farmId: 'farm-a' },
    actions: [{ type: 'DEVICE_COMMAND', deviceId: 'pump-a', command: 'PUMP_ON', farmId: 'farm-a', fieldId: 'field-a', payload: { source: 'EXECUTION_SERVICE', mode: 'ASSISTED' } }],
    executions: [{ id: 'execution-a', status, requestId: 'plan-execution-a:pump-a:PUMP_ON' }]
  };
  const prisma: any = {
    actionPlan: { findUnique: async () => plan },
    irrigationRotationRun: { findFirst: async () => null },
    fertigationTask: { findFirst: async () => null },
    usageRecord: {
      findFirst: async ({ where }: any) => usages.find((item) => item.tenantId === where.tenantId && item.usageType === where.usageType && item.metadata.refId === where.metadata.equals) ?? null,
      create: async ({ data }: any) => { const value = { id: `usage-${usages.length + 1}`, ...data }; usages.push(value); return value; }
    }
  };
  const linker = new ExecutionResultLinkerService(prisma, { publish: (name: string, payload: any, tenantId: string) => events.push({ name, payload, tenantId }) } as any);
  return { linker, plan, usages, events };
}

async function queueExecutionRequest() {
  const ctx = new RequestContextService(); const usages: any[] = []; const events: any[] = [];
  const prisma: any = { field: { findFirst: async () => ({ id: 'field-a', farmId: 'farm-a' }) }, device: { findFirst: async () => ({ id: 'pump-a' }) }, decisionRecord: { create: async ({ data }: any) => ({ id: 'decision-a', ...data }) }, actionPlan: { create: async ({ data }: any) => ({ id: 'plan-a', ...data }) }, usageRecord: { create: async ({ data }: any) => { usages.push(data); return data; } } };
  const queue = { enqueue: async () => ({ id: 'job-a', status: 'QUEUED' }) };
  const service = new ExecutionService({ check: async () => ({ allowed: true, risks: [] }) } as any, {} as any, { create: async () => undefined } as any, ctx, prisma, { get: () => queue } as any);
  const response = await runIn(ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, () => service.run({ mode: 'ASSISTED', fieldId: 'field-a', deviceId: 'pump-a', command: 'PUMP_ON' } as any));
  return { response, usages, events };
}
test('1 ExecutionService queueing produces no usage record', async () => { const f = await queueExecutionRequest(); assert.equal(f.response.queued, true); assert.equal(f.usages.length, 0); });
test('2 QUEUED produces no action.executed completion event', async () => { const f = await queueExecutionRequest(); assert.equal(f.events.length, 0); });
test('3 FEEDBACK_PENDING produces no usage', async () => { const f = lifecycleFixture('FEEDBACK_PENDING'); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.usages.length, 0); });
test('4 OUTCOME_UNKNOWN produces no usage', async () => { const f = lifecycleFixture('OUTCOME_UNKNOWN'); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.usages.length, 0); });
test('5 FAILED produces no successful usage', async () => { const f = lifecycleFixture('FAILED'); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.usages.length, 0); });
test('6 physical confirmation creates exactly one DEVICE_EXECUTION usage', async () => { const f = lifecycleFixture(); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.usages.length, 1); assert.equal(f.usages[0].usageType, 'DEVICE_EXECUTION'); });
test('7 action.executed is published only after physical success', async () => { const f = lifecycleFixture(); await f.linker.linkActionPlanResult(f.plan.id); assert.deepEqual(f.events.map((item) => item.name), ['action.executed']); assert.equal(f.events[0].payload.physicalConfirmed, true); });
test('8 repeated linker invocation does not duplicate usage', async () => { const f = lifecycleFixture(); await f.linker.linkActionPlanResult(f.plan.id); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.usages.length, 1); });
test('9 repeated linker invocation does not duplicate completion event', async () => { const f = lifecycleFixture(); await f.linker.linkActionPlanResult(f.plan.id); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.events.filter((item) => item.name === 'action.executed').length, 1); });
test('10 usage preserves tenant resource and stable ActionPlan reference', async () => { const f = lifecycleFixture(); await f.linker.linkActionPlanResult(f.plan.id); assert.deepEqual(f.usages[0], { id: 'usage-1', tenantId: 'tenant-a', farmId: 'farm-a', fieldId: 'field-a', deviceId: 'pump-a', usageType: 'DEVICE_EXECUTION', quantity: 1, unit: 'execution', costAmount: 0, metadata: { refType: 'ActionPlan', refId: 'plan-execution-a' } }); });

function queueFixture(planTenant = 'tenant-a') {
  const ctx = new RequestContextService();
  const jobs: any[] = [];
  const adapterJobs: string[] = [];
  const executorCalls: any[] = [];
  const plan = { id: 'plan-a', tenantId: planTenant, actions: [{ type: 'DEVICE_COMMAND', command: 'VALVE_OPEN' }] };
  const prisma: any = {
    actionPlan: { findFirst: async ({ where }: any) => where.id === plan.id && where.tenantId === plan.tenantId ? plan : null },
    farm: { findFirst: async ({ where }: any) => where.id === 'farm-a' && where.tenantId === plan.tenantId ? { id: 'farm-a' } : null },
    actionQueueJob: {
      create: async ({ data }: any) => { const value = { id: 'job-a', retryCount: 0, ...data }; jobs.push(value); return value; },
      findUnique: async () => jobs[0],
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }: any) => Object.assign(jobs[0], data)
    }
  };
  const executor = { executePlan: async (id: string, options: any) => { executorCalls.push({ id, options }); return { status: 'EXECUTED', executions: [{ id: 'execution-a' }] }; } };
  const queue = new ActionQueueService(prisma, ctx, executor as any, { publish: () => undefined } as any, { linkActionPlanResult: async () => undefined } as any, { get: () => undefined } as any);
  (queue as any).adapter = { name: 'test', handlesProcessing: true, enqueue: async (id: string) => adapterJobs.push(id), size: async () => 0, next: async () => undefined };
  return { ctx, queue, jobs, adapterJobs, executorCalls };
}

test('11 normal tenant A queues tenant A plan', async () => { const f = queueFixture(); await runIn(f.ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' })); assert.equal(f.jobs[0].tenantId, 'tenant-a'); });
test('12 normal tenant A cannot queue tenant B plan', async () => { const f = queueFixture('tenant-b'); await assert.rejects(() => runIn(f.ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }))); assert.equal(f.jobs.length, 0); });
test('13 normal tenant A cannot explicitly override tenant B', async () => { const f = queueFixture('tenant-b'); await assert.rejects(() => runIn(f.ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }, { tenantId: 'tenant-b' })), /cannot override/); });
test('14 PLATFORM_ADMIN without context tenant can enqueue validated tenant B plan', async () => { const f = queueFixture('tenant-b'); await runIn(f.ctx, { role: 'PLATFORM_ADMIN' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }, { tenantId: 'tenant-b' })); assert.equal(f.jobs.length, 1); });
test('15 PLATFORM_ADMIN job persists tenant B', async () => { const f = queueFixture('tenant-b'); await runIn(f.ctx, { role: 'PLATFORM_ADMIN' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }, { tenantId: 'tenant-b' })); assert.equal(f.jobs[0].tenantId, 'tenant-b'); });
test('16 background processing receives persisted tenant B', async () => { const f = queueFixture('tenant-b'); await runIn(f.ctx, { role: 'PLATFORM_ADMIN' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }, { tenantId: 'tenant-b' })); await (f.queue as any).processJob('job-a'); assert.equal(f.executorCalls[0].options.tenantId, 'tenant-b'); });
test('17 ActionExecutor lookup is handed plan and tenant B', async () => { const f = queueFixture('tenant-b'); await runIn(f.ctx, { role: 'PLATFORM_ADMIN' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }, { tenantId: 'tenant-b' })); await (f.queue as any).processJob('job-a'); assert.deepEqual(f.executorCalls[0], { id: 'plan-a', options: { tenantId: 'tenant-b' } }); });
test('18 rejected cross-tenant request performs no dispatch', async () => { const f = queueFixture('tenant-b'); await assert.rejects(() => runIn(f.ctx, { tenantId: 'tenant-a', role: 'FARM_MANAGER' }, () => f.queue.enqueue({ farmId: 'farm-a', actionPlanId: 'plan-a' }))); assert.equal(f.executorCalls.length, 0); assert.equal(f.adapterJobs.length, 0); });
test('19 PLATFORM_ADMIN mobile valve response never claims physical completion', async () => { const f = queueFixture('tenant-b'); const device = { id: 'valve-b', tenantId: 'tenant-b', fieldId: 'field-b', field: { id: 'field-b', tenantId: 'tenant-b', farmId: 'farm-a' } }; const prisma: any = { ...((f.queue as any).prisma), device: { findFirst: async () => device }, decisionRecord: { create: async ({ data }: any) => ({ id: 'decision-b', ...data }) }, actionPlan: { findFirst: (f.queue as any).prisma.actionPlan.findFirst, create: async ({ data }: any) => ({ id: 'plan-a', ...data }) } }; (f.queue as any).prisma = prisma; const mobile = new MobileService(prisma, {} as any, { get: () => f.queue } as any); const response: any = await runIn(f.ctx, { role: 'PLATFORM_ADMIN' }, () => mobile.valve({ deviceId: 'valve-b', command: 'VALVE_OPEN' }, { id: 'admin', role: 'PLATFORM_ADMIN' } as any)); assert.equal(f.jobs[0].tenantId, 'tenant-b'); assert.equal(response.queued, true); assert.equal(response.executed, false); assert.equal(response.physicalConfirmed, false); });

async function main() { let passed = 0; for (const item of tests) { try { await item.run(); passed++; console.log(`PASS ${item.name}`); } catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; } } console.log(`R1-B.1 PHYSICAL BUSINESS LIFECYCLE: ${passed}/${tests.length} PASS`); if (passed !== tests.length) process.exitCode = 1; }
void main();
