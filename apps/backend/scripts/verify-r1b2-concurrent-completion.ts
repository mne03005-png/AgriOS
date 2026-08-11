import 'reflect-metadata';
import assert = require('node:assert/strict');
import { Prisma } from '@prisma/client';
import { ExecutionResultLinkerService } from '../src/modules/execution/execution-result-linker.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const duplicateError = () => new Prisma.PrismaClientKnownRequestError('duplicate deterministic usage id', { code: 'P2002', clientVersion: '6.10.0', meta: { target: ['PRIMARY'] } });

function matchesSemantic(record: any, where: any) {
  const filters = where.AND ?? [];
  const expected = Object.fromEntries(filters.map((item: any) => [item.metadata.path[0], item.metadata.equals]));
  return record.tenantId === where.tenantId && record.usageType === where.usageType
    && record.metadata?.refType === expected.refType && record.metadata?.refId === expected.refId;
}

function fixture(options: { historical?: any; barrierSize?: number; createError?: Error } = {}) {
  const usages: any[] = options.historical ? [options.historical] : [];
  const events: any[] = [];
  let waiting = 0;
  let releaseBarrier!: () => void;
  const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });
  const plan: any = {
    id: 'plan-a', tenantId: 'tenant-a', fieldId: 'field-a', status: 'EXECUTED',
    decision: { metadata: { source: 'EXECUTION_SERVICE' } },
    actions: [{ type: 'DEVICE_COMMAND', deviceId: 'pump-a', command: 'PUMP_ON', farmId: 'farm-a', fieldId: 'field-a', payload: { source: 'EXECUTION_SERVICE', mode: 'ASSISTED' } }],
    executions: [{ id: 'execution-a', status: 'PHYSICALLY_CONFIRMED', requestId: 'plan-a:pump-a:PUMP_ON' }]
  };
  const prisma: any = {
    actionPlan: { findUnique: async () => plan }, irrigationRotationRun: { findFirst: async () => null }, fertigationTask: { findFirst: async () => null },
    usageRecord: {
      findFirst: async ({ where }: any) => {
        const found = usages.find((item) => matchesSemantic(item, where)) ?? null;
        if (!found && options.barrierSize) {
          waiting++;
          if (waiting === options.barrierSize) releaseBarrier();
          await barrier;
        }
        return found;
      },
      create: async ({ data }: any) => {
        if (options.createError) throw options.createError;
        if (usages.some((item) => item.id === data.id)) throw duplicateError();
        const value = { ...data };
        usages.push(value);
        return value;
      }
    }
  };
  const linker = new ExecutionResultLinkerService(prisma, { publish: (name: string, payload: any) => events.push({ name, payload }) } as any);
  return { linker, usages, events, plan };
}

test('1 two concurrent physical completions create one usage and one event', async () => { const f = fixture({ barrierSize: 2 }); await Promise.all([f.linker.linkActionPlanResult(f.plan.id), f.linker.linkActionPlanResult(f.plan.id)]); assert.equal(f.usages.length, 1); assert.equal(f.events.length, 1); });
test('2 ten concurrent physical completions create one usage and one event', async () => { const f = fixture({ barrierSize: 10 }); await Promise.all(Array.from({ length: 10 }, () => f.linker.linkActionPlanResult(f.plan.id))); assert.equal(f.usages.length, 1); assert.equal(f.events.length, 1); });
test('3 sequential replay remains idempotent', async () => { const f = fixture(); await f.linker.linkActionPlanResult(f.plan.id); await f.linker.linkActionPlanResult(f.plan.id); assert.equal(f.usages.length, 1); assert.equal(f.events.length, 1); });
test('4 historical random ID is reused without deterministic duplicate', async () => { const historical = { id: 'cm-old-random-cuid', tenantId: 'tenant-a', usageType: 'DEVICE_EXECUTION', metadata: { refType: 'ActionPlan', refId: 'plan-a' } }; const f = fixture({ historical }); await f.linker.linkActionPlanResult(f.plan.id); assert.deepEqual(f.usages, [historical]); assert.equal(f.events.length, 0); });
test('5 same identity produces the same deterministic ID', async () => { const f = fixture(); const first = await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); const id = first.record.id; const second = await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); assert.equal(second.record.id, id); assert.equal(second.created, false); });
test('6 different refId does not over-deduplicate', async () => { const f = fixture(); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-b', 'ActionPlan'); assert.equal(f.usages.length, 2); });
test('7 different tenant does not over-deduplicate', async () => { const f = fixture(); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); await (f.linker as any).recordUsageOnce('tenant-b', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); assert.equal(f.usages.length, 2); });
test('8 different usage type does not over-deduplicate', async () => { const f = fixture(); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'IRRIGATION_ACTION', 'ref-a', 'ActionPlan'); assert.equal(f.usages.length, 2); });
test('9 different refType does not over-deduplicate', async () => { const f = fixture(); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'); await (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'FertigationTask'); assert.equal(f.usages.length, 2); });
test('10 expected P2002 returns the semantic winner', async () => { const f = fixture({ barrierSize: 2 }); const results = await Promise.all([(f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'), (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan')]); assert.equal(results.filter((item) => item.created).length, 1); assert.equal(results.filter((item) => !item.created).length, 1); });
test('11 unrelated database error is rethrown', async () => { const error = new Error('database unavailable'); const f = fixture({ createError: error }); await assert.rejects(() => (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'), (received) => received === error); });
test('12 P2002 without semantic winner is rethrown', async () => { const f = fixture({ createError: duplicateError() }); await assert.rejects(() => (f.linker as any).recordUsageOnce('tenant-a', 'farm-a', 'field-a', 'DEVICE_EXECUTION', 'ref-a', 'ActionPlan'), (received: any) => received?.code === 'P2002'); });

async function main() { let passed = 0; for (const item of tests) { try { await item.run(); passed++; console.log(`PASS ${item.name}`); } catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; } } console.log(`R1-B.2 CONCURRENT COMPLETION: ${passed}/${tests.length} PASS`); if (passed !== tests.length) process.exitCode = 1; }
void main();
