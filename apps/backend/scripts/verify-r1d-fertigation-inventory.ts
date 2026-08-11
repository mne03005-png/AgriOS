import 'reflect-metadata';
import assert = require('node:assert/strict');
import { Prisma } from '@prisma/client';
import { ExecutionResultLinkerService } from '../src/modules/execution/execution-result-linker.service';

type Test = { name: string; run: () => void | Promise<void> }; const tests: Test[] = []; const test = (name: string, run: Test['run']) => tests.push({ name, run });
type TaskSeed = { id: string; volume: unknown; tenantId?: string; tankId?: string | null; status?: string; resultJson?: any; executionStatus?: string };

function fixture(seeds: TaskSeed[], initialLevel = 100, tankTenant = 'tenant-a') {
  const tank: any = { id: 'tank-a', tenantId: tankTenant, farmId: 'farm-a', currentLevelL: new Prisma.Decimal(initialLevel) };
  const tasks = new Map<string, any>(); const plans = new Map<string, any>(); const reports: any[] = []; const activities: any[] = []; const usages: any[] = []; const events: any[] = [];
  let transactionTail = Promise.resolve(); let crashAfterTankMutation = false;
  for (const seed of seeds) {
    const planId = `plan-${seed.id}`;
    const task = { id: seed.id, tenantId: seed.tenantId ?? 'tenant-a', farmId: 'farm-a', fieldId: 'field-a', tankId: seed.tankId === undefined ? 'tank-a' : seed.tankId, targetFertilizerVolume: seed.volume, targetWaterVolume: 10, durationMinutes: 5, actionPlanId: planId, status: seed.status ?? 'QUEUED', resultJson: seed.resultJson ?? {} };
    tasks.set(seed.id, task);
    plans.set(planId, { id: planId, tenantId: task.tenantId, fieldId: task.fieldId, status: 'EXECUTED', decision: {}, actions: [{ type: 'DEVICE_COMMAND', payload: { taskId: task.id, targetFertilizerVolume: seed.volume } }], executions: [{ id: `execution-${seed.id}`, status: seed.executionStatus ?? 'PHYSICALLY_CONFIRMED' }] });
  }
  const cloneTask = (value: any) => structuredClone(value);
  const txApi = () => ({
    fertigationTask: {
      findUnique: async ({ where }: any) => tasks.has(where.id) ? cloneTask(tasks.get(where.id)) : null,
      updateMany: async ({ where, data }: any) => { const item = tasks.get(where.id); if (!item || (where.status?.not === 'SUCCESS' && item.status === 'SUCCESS')) return { count: 0 }; Object.assign(item, data); return { count: 1 }; },
      update: async ({ where, data }: any) => { const item = tasks.get(where.id); Object.assign(item, data); return cloneTask(item); }
    },
    fertilizerTank: {
      findFirst: async ({ where }: any) => tank.id === where.id && tank.tenantId === where.tenantId && tank.farmId === where.farmId ? { ...tank } : null,
      update: async ({ data }: any) => { tank.currentLevelL = tank.currentLevelL.minus(data.currentLevelL.decrement); if (crashAfterTankMutation) throw new Error('SIMULATED_CRASH_BEFORE_COMMIT'); return { ...tank }; }
    }
  });
  const prisma: any = {
    actionPlan: { findUnique: async ({ where }: any) => plans.get(where.id) },
    irrigationRotationRun: { findFirst: async () => null },
    fertigationTask: {
      findFirst: async ({ where }: any) => [...tasks.values()].find((item) => item.actionPlanId === where.actionPlanId) ?? null,
      findUnique: async ({ where }: any) => tasks.get(where.id) ? cloneTask(tasks.get(where.id)) : null,
      update: async ({ where, data }: any) => { const item = tasks.get(where.id); Object.assign(item, data); return cloneTask(item); }
    },
    $transaction: async (callback: any) => {
      let release!: () => void; const prior = transactionTail; transactionTail = new Promise<void>((resolve) => { release = resolve; }); await prior;
      const taskSnapshot = new Map([...tasks].map(([key, value]) => [key, cloneTask(value)])); const tankSnapshot = tank.currentLevelL;
      try { return await callback(txApi()); } catch (error) { tasks.clear(); for (const [key, value] of taskSnapshot) tasks.set(key, value); tank.currentLevelL = tankSnapshot; throw error; } finally { release(); }
    },
    operationReport: { findFirst: async ({ where }: any) => reports.find((item) => item.type === where.type && item.refId === where.refId) ?? null, create: async ({ data }: any) => { const value = { id: `report-${reports.length + 1}`, ...data }; reports.push(value); return value; }, update: async ({ where, data }: any) => Object.assign(reports.find((item) => item.id === where.id), data) },
    farmActivity: { findFirst: async ({ where }: any) => activities.find((item) => item.type === where.type && item.refType === where.refType && item.refId === where.refId) ?? null, create: async ({ data }: any) => { const value = { id: `activity-${activities.length + 1}`, ...data }; activities.push(value); return value; } },
    usageRecord: { findFirst: async ({ where }: any) => { const metadata = Object.fromEntries((where.AND ?? []).map((item: any) => [item.metadata.path[0], item.metadata.equals])); return usages.find((item) => item.tenantId === where.tenantId && item.usageType === where.usageType && item.metadata.refType === metadata.refType && item.metadata.refId === metadata.refId) ?? null; }, create: async ({ data }: any) => { if (usages.some((item) => item.id === data.id)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.10.0' }); usages.push(data); return data; } }
  };
  const linker = new ExecutionResultLinkerService(prisma, { publish: (name: string, payload: any) => events.push({ name, payload }) } as any);
  const complete = (id: string) => linker.linkActionPlanResult(`plan-${id}`, { id: `job-${id}` });
  return { linker, complete, tank, tasks, reports, activities, usages, events, setCrash: (value: boolean) => { crashAfterTankMutation = value; } };
}

test('1 single task applies 100 - 30 = 70', async () => { const f = fixture([{ id: 'a', volume: 30 }]); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 70); });
test('2 same task sequential replay remains 70', async () => { const f = fixture([{ id: 'a', volume: 30 }]); await f.complete('a'); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 70); });
test('3 same task two-way concurrent replay remains 70', async () => { const f = fixture([{ id: 'a', volume: 30 }]); await Promise.all([f.complete('a'), f.complete('a')]); assert.equal(f.tank.currentLevelL.toNumber(), 70); });
test('4 same task ten-way concurrent replay remains 70', async () => { const f = fixture([{ id: 'a', volume: 30 }]); await Promise.all(Array.from({ length: 10 }, () => f.complete('a'))); assert.equal(f.tank.currentLevelL.toNumber(), 70); });
test('5 different tasks concurrently accumulate 30 + 40', async () => { const f = fixture([{ id: 'a', volume: 30 }, { id: 'b', volume: 40 }]); await Promise.all([f.complete('a'), f.complete('b')]); assert.equal(f.tank.currentLevelL.toNumber(), 30); assert.equal(f.tasks.get('a').status, 'SUCCESS'); assert.equal(f.tasks.get('b').status, 'SUCCESS'); });
test('6 ten different 5 L tasks result in 50', async () => { const seeds = Array.from({ length: 10 }, (_, index) => ({ id: `t${index}`, volume: 5 })); const f = fixture(seeds); await Promise.all(seeds.map((item) => f.complete(item.id))); assert.equal(f.tank.currentLevelL.toNumber(), 50); });
for (const [number, status] of [[7, 'FAILED'], [8, 'FEEDBACK_PENDING'], [9, 'OUTCOME_UNKNOWN'], [10, 'FEEDBACK_TIMEOUT'], [11, 'FEEDBACK_MISMATCH']] as const) test(`${number} ${status} does not decrement`, async () => { const f = fixture([{ id: 'a', volume: 30, executionStatus: status }]); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 100); });
test('12 insufficient stock clamps to zero and records anomaly', async () => { const f = fixture([{ id: 'a', volume: 40 }], 30); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 0); assert.equal(f.tasks.get('a').status, 'SUCCESS'); assert.ok(f.tasks.get('a').resultJson.anomalies.includes('INSUFFICIENT_RECORDED_FERTILIZER_STOCK')); });
test('13 zero volume leaves inventory unchanged', async () => { const f = fixture([{ id: 'a', volume: 0 }]); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 100); });
test('14 negative volume never increases inventory', async () => { const f = fixture([{ id: 'a', volume: -30 }]); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 100); assert.ok(f.tasks.get('a').resultJson.anomalies.includes('INVALID_TARGET_FERTILIZER_VOLUME')); });
test('15 historical applied JSON marker prevents reconsumption', async () => { const f = fixture([{ id: 'a', volume: 30, status: 'SUCCESS', resultJson: { physicalCompletionApplied: true } }], 70); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 70); });
test('16 crash before commit rolls back task and tank', async () => { const f = fixture([{ id: 'a', volume: 30 }]); f.setCrash(true); await assert.rejects(() => f.complete('a'), /SIMULATED_CRASH/); assert.equal(f.tank.currentLevelL.toNumber(), 100); assert.equal(f.tasks.get('a').status, 'QUEUED'); assert.notEqual(f.tasks.get('a').resultJson.physicalCompletionApplied, true); });
test('17 replay after crash applies exactly once', async () => { const f = fixture([{ id: 'a', volume: 30 }]); f.setCrash(true); await assert.rejects(() => f.complete('a')); f.setCrash(false); await f.complete('a'); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 70); assert.equal(f.tasks.get('a').resultJson.physicalCompletionApplied, true); });
test('18 concurrent before/after values reflect serialized order', async () => { const f = fixture([{ id: 'a', volume: 30 }, { id: 'b', volume: 40 }]); await Promise.all([f.complete('a'), f.complete('b')]); const pairs = [f.tasks.get('a').resultJson, f.tasks.get('b').resultJson].map((item) => [item.tankBeforeLevel, item.tankAfterLevel]); assert.deepEqual(pairs, [[100, 70], [70, 30]]); });
test('19 cross-tenant tank is not mutated and anomaly is recorded', async () => { const f = fixture([{ id: 'a', volume: 30, tenantId: 'tenant-a' }], 100, 'tenant-b'); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 100); assert.ok(f.tasks.get('a').resultJson.anomalies.includes('FERTILIZER_TANK_NOT_FOUND_OR_SCOPE_MISMATCH')); });
test('20 report activity and usage remain replay-idempotent', async () => { const f = fixture([{ id: 'a', volume: 30 }]); await f.complete('a'); await f.complete('a'); assert.equal(f.reports.length, 1); assert.equal(f.activities.length, 1); assert.equal(f.usages.length, 1); });
test('21 missing tank records anomaly without failing physical success', async () => { const f = fixture([{ id: 'a', volume: 30, tankId: null }]); await f.complete('a'); assert.equal(f.tasks.get('a').status, 'SUCCESS'); assert.ok(f.tasks.get('a').resultJson.anomalies.includes('FERTILIZER_TANK_NOT_ASSIGNED')); });
test('22 NaN target never increases inventory', async () => { const f = fixture([{ id: 'a', volume: Number.NaN }]); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 100); assert.equal(f.tasks.get('a').resultJson.targetFertilizerVolume, null); assert.ok(f.tasks.get('a').resultJson.anomalies.includes('INVALID_TARGET_FERTILIZER_VOLUME')); });
test('23 Infinity target never increases inventory', async () => { const f = fixture([{ id: 'a', volume: Number.POSITIVE_INFINITY }]); await f.complete('a'); assert.equal(f.tank.currentLevelL.toNumber(), 100); assert.equal(f.tasks.get('a').resultJson.targetFertilizerVolume, null); assert.ok(f.tasks.get('a').resultJson.anomalies.includes('INVALID_TARGET_FERTILIZER_VOLUME')); });

async function main() { let passed = 0; for (const item of tests) { try { await item.run(); passed++; console.log(`PASS ${item.name}`); } catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; } } console.log(`R1-D FERTIGATION INVENTORY: ${passed}/${tests.length} PASS`); if (passed !== tests.length) process.exitCode = 1; }
void main();
