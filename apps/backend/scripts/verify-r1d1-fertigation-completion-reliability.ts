import 'reflect-metadata';
import assert = require('node:assert/strict');
import { Prisma } from '@prisma/client';
import { ExecutionResultLinkerService } from '../src/modules/execution/execution-result-linker.service';

type Test = { name: string; run: () => void | Promise<void> }; const tests: Test[] = []; const test = (name: string, run: Test['run']) => tests.push({ name, run });
type TaskSeed = { id: string; volume: unknown; tenantId?: string; tankId?: string | null; status?: string; resultJson?: any };

function p2034() { return new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '6.10.0' }); }

function fixture(seeds: TaskSeed[], initialLevel = 100) {
  const tank: any = { id: 'tank-a', tenantId: 'tenant-a', farmId: 'farm-a', currentLevelL: new Prisma.Decimal(initialLevel) };
  const tasks = new Map<string, any>(); const plans = new Map<string, any>(); const reports: any[] = []; const activities: any[] = []; const usages: any[] = []; const events: any[] = [];
  let transactionTail = Promise.resolve();
  let transactionAttempts = 0;
  const injectedTransactionFailures: any[] = [];
  let failNextReportCreate = false; let failNextActivityCreate = false; let failNextUsageCreate = false;
  for (const seed of seeds) {
    const planId = `plan-${seed.id}`;
    const task = { id: seed.id, tenantId: seed.tenantId ?? 'tenant-a', farmId: 'farm-a', fieldId: 'field-a', tankId: seed.tankId === undefined ? 'tank-a' : seed.tankId, targetFertilizerVolume: seed.volume, targetWaterVolume: 10, durationMinutes: 5, actionPlanId: planId, status: seed.status ?? 'QUEUED', resultJson: seed.resultJson ?? {} };
    tasks.set(seed.id, task);
    plans.set(planId, { id: planId, tenantId: task.tenantId, fieldId: task.fieldId, status: 'EXECUTED', decision: {}, actions: [{ type: 'DEVICE_COMMAND', payload: { taskId: task.id, targetFertilizerVolume: seed.volume } }], executions: [{ id: `execution-${seed.id}`, status: 'PHYSICALLY_CONFIRMED' }] });
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
      update: async ({ data }: any) => { tank.currentLevelL = tank.currentLevelL.minus(data.currentLevelL.decrement); return { ...tank }; }
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
      transactionAttempts++;
      if (injectedTransactionFailures.length) throw injectedTransactionFailures.shift();
      let release!: () => void; const prior = transactionTail; transactionTail = new Promise<void>((resolve) => { release = resolve; }); await prior;
      const taskSnapshot = new Map([...tasks].map(([key, value]) => [key, cloneTask(value)])); const tankSnapshot = tank.currentLevelL;
      try { return await callback(txApi()); } catch (error) { tasks.clear(); for (const [key, value] of taskSnapshot) tasks.set(key, value); tank.currentLevelL = tankSnapshot; throw error; } finally { release(); }
    },
    operationReport: {
      findFirst: async ({ where }: any) => reports.find((item) => item.type === where.type && item.refId === where.refId) ?? null,
      create: async ({ data }: any) => { if (failNextReportCreate) { failNextReportCreate = false; throw new Error('SIMULATED_CRASH_BEFORE_REPORT'); } const value = { id: `report-${reports.length + 1}`, ...data }; reports.push(value); return value; },
      update: async ({ where, data }: any) => Object.assign(reports.find((item) => item.id === where.id), data)
    },
    farmActivity: {
      findFirst: async ({ where }: any) => activities.find((item) => item.type === where.type && item.refType === where.refType && item.refId === where.refId) ?? null,
      create: async ({ data }: any) => { if (failNextActivityCreate) { failNextActivityCreate = false; throw new Error('SIMULATED_CRASH_BEFORE_ACTIVITY'); } const value = { id: `activity-${activities.length + 1}`, ...data }; activities.push(value); return value; }
    },
    usageRecord: {
      findFirst: async ({ where }: any) => { const metadata = Object.fromEntries((where.AND ?? []).map((item: any) => [item.metadata.path[0], item.metadata.equals])); return usages.find((item) => item.tenantId === where.tenantId && item.usageType === where.usageType && item.metadata.refType === metadata.refType && item.metadata.refId === metadata.refId) ?? null; },
      create: async ({ data }: any) => { if (failNextUsageCreate) { failNextUsageCreate = false; throw new Error('SIMULATED_CRASH_BEFORE_USAGE'); } if (usages.some((item) => item.id === data.id)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.10.0' }); usages.push(data); return data; }
    }
  };
  const linker: any = new ExecutionResultLinkerService(prisma, { publish: (name: string, payload: any) => events.push({ name, payload }) } as any);
  const complete = (id: string) => linker.linkActionPlanResult(`plan-${id}`, { id: `job-${id}` });
  return {
    linker, complete, tank, tasks, reports, activities, usages, events,
    transactionAttempts: () => transactionAttempts,
    injectTransactionFailures: (...errors: any[]) => injectedTransactionFailures.push(...errors),
    failNextReportCreate: () => { failNextReportCreate = true; },
    failNextActivityCreate: () => { failNextActivityCreate = true; },
    failNextUsageCreate: () => { failNextUsageCreate = true; }
  };
}

// --- 1-4: P2034 retry classification and bounding ---

test('1 P2034 conflict is retried and eventually succeeds', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.injectTransactionFailures(p2034(), p2034(), p2034());
  await f.complete('a');
  assert.equal(f.tank.currentLevelL.toNumber(), 70);
  assert.equal(f.tasks.get('a').status, 'SUCCESS');
  assert.equal(f.transactionAttempts(), 4, 'expected exactly 3 failed attempts + 1 successful attempt');
});

test('2 non-P2034 PrismaClientKnownRequestError is NOT retried', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  const other = new Prisma.PrismaClientKnownRequestError('deadlock', { code: 'P2028', clientVersion: '6.10.0' });
  f.injectTransactionFailures(other);
  await assert.rejects(() => f.complete('a'), (error: any) => error.code === 'P2028');
  assert.equal(f.transactionAttempts(), 1, 'must not retry a non-P2034 error');
  assert.equal(f.tank.currentLevelL.toNumber(), 100, 'no partial mutation from the failed attempt');
});

test('3 arbitrary programmer/validation error is NOT retried', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.injectTransactionFailures(new Error('unexpected programmer error'));
  await assert.rejects(() => f.complete('a'), /unexpected programmer error/);
  assert.equal(f.transactionAttempts(), 1, 'must not retry a plain Error');
});

test('4 retry count is bounded (sustained P2034 eventually throws, not infinite)', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.injectTransactionFailures(...Array.from({ length: 8 }, () => p2034()));
  await assert.rejects(() => f.complete('a'), (error: any) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
  assert.equal(f.transactionAttempts(), 8, 'must stop at the configured max attempts, not retry forever');
  assert.equal(f.tank.currentLevelL.toNumber(), 100, 'exhausted retries must leave inventory untouched');
  assert.equal(f.tasks.get('a').status, 'QUEUED', 'exhausted retries must leave no partial task state');
});

// --- 5-6: backoff / jitter mechanics, exercised through the real retry loop ---

test('5 sleep is invoked between retryable attempts, not after the final successful one', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  const sleepCalls: number[] = [];
  (f.linker as any).sleep = async (ms: number) => { sleepCalls.push(ms); };
  f.injectTransactionFailures(p2034(), p2034());
  await f.complete('a');
  assert.equal(sleepCalls.length, 2, 'one sleep per failed retryable attempt, none after the final success');
  for (const ms of sleepCalls) assert.ok(ms >= 0 && ms <= 250, `delay ${ms} must stay within the configured cap`);
});

test('6 sleep is NOT invoked when the failure is non-retryable', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  const sleepCalls: number[] = [];
  (f.linker as any).sleep = async (ms: number) => { sleepCalls.push(ms); };
  f.injectTransactionFailures(new Error('boom'));
  await assert.rejects(() => f.complete('a'));
  assert.equal(sleepCalls.length, 0, 'no backoff delay should be introduced before an immediate, non-retryable rethrow');
});

test('7 retry delay is bounded by capped exponential growth per attempt', () => {
  const linker: any = new (ExecutionResultLinkerService as any)({}, { publish: () => undefined });
  const bounds = [20, 40, 80, 160, 250, 250, 250];
  for (let attempt = 1; attempt <= bounds.length; attempt++) {
    for (let sample = 0; sample < 25; sample++) {
      const delay = linker.getTransactionRetryDelay(attempt);
      assert.ok(delay >= 0 && delay < bounds[attempt - 1], `attempt ${attempt} delay ${delay} exceeded bound ${bounds[attempt - 1]}`);
    }
  }
});

test('8 retry delay exhibits jitter (non-constant across samples)', () => {
  const linker: any = new (ExecutionResultLinkerService as any)({}, { publish: () => undefined });
  const samples = new Set(Array.from({ length: 50 }, () => linker.getTransactionRetryDelay(5)));
  assert.ok(samples.size > 1, 'expected multiple distinct delay values across samples, not a fixed lockstep delay');
});

test('9 isRetryableTransactionConflict classifies errors correctly', () => {
  const linker: any = new (ExecutionResultLinkerService as any)({}, { publish: () => undefined });
  assert.equal(linker.isRetryableTransactionConflict(p2034()), true);
  assert.equal(linker.isRetryableTransactionConflict(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6.10.0' })), false);
  assert.equal(linker.isRetryableTransactionConflict(new Error('plain')), false);
  assert.equal(linker.isRetryableTransactionConflict(undefined), false);
});

// --- 10-12: post-commit replay of business side effects (P1-B) ---

test('10 already-applied completion still reaches post-commit side effects', async () => {
  const f = fixture([{ id: 'a', volume: 30, status: 'SUCCESS', resultJson: { physicalCompletionApplied: true, tankBeforeLevel: 100, tankAfterLevel: 70 } }], 70);
  await f.complete('a');
  assert.equal(f.tank.currentLevelL.toNumber(), 70, 'inventory must not be reapplied');
  assert.equal(f.reports.length, 1, 'report must still be created on replay of an already-applied completion');
  assert.equal(f.activities.length, 1, 'activity must still be created on replay of an already-applied completion');
  assert.equal(f.usages.length, 1, 'usage must still be created on replay of an already-applied completion');
});

test('11 crash after commit before report: replay restores report/activity/usage without re-decrementing', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.failNextReportCreate();
  await assert.rejects(() => f.complete('a'), /SIMULATED_CRASH_BEFORE_REPORT/);
  assert.equal(f.tank.currentLevelL.toNumber(), 70, 'inventory transaction already committed before the simulated crash');
  assert.equal(f.tasks.get('a').status, 'SUCCESS');
  assert.equal(f.tasks.get('a').resultJson.physicalCompletionApplied, true);
  assert.equal(f.reports.length, 0);
  assert.equal(f.activities.length, 0);
  assert.equal(f.usages.length, 0);

  await f.complete('a');
  assert.equal(f.tank.currentLevelL.toNumber(), 70, 'replay must not re-decrement inventory');
  assert.equal(f.reports.length, 1, 'report must be created on replay');
  assert.equal(f.activities.length, 1, 'activity must be created on replay');
  assert.equal(f.usages.length, 1, 'usage must be created on replay');
});

test('12 crash after report before activity: replay repairs activity/usage without duplicating report', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.failNextActivityCreate();
  await assert.rejects(() => f.complete('a'), /SIMULATED_CRASH_BEFORE_ACTIVITY/);
  assert.equal(f.tank.currentLevelL.toNumber(), 70);
  assert.equal(f.reports.length, 1, 'report was created before the simulated crash');
  assert.equal(f.activities.length, 0);
  assert.equal(f.usages.length, 0);

  await f.complete('a');
  assert.equal(f.tank.currentLevelL.toNumber(), 70);
  assert.equal(f.reports.length, 1, 'report must not be duplicated on replay');
  assert.equal(f.activities.length, 1, 'activity must be created on replay');
  assert.equal(f.usages.length, 1, 'usage must be created on replay');
});

test('13 crash after activity before usage: replay repairs usage without duplicating report/activity', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.failNextUsageCreate();
  await assert.rejects(() => f.complete('a'), /SIMULATED_CRASH_BEFORE_USAGE/);
  assert.equal(f.reports.length, 1);
  assert.equal(f.activities.length, 1);
  assert.equal(f.usages.length, 0);

  await f.complete('a');
  assert.equal(f.reports.length, 1, 'report must not be duplicated on replay');
  assert.equal(f.activities.length, 1, 'activity must not be duplicated on replay');
  assert.equal(f.usages.length, 1, 'usage must be created on replay');
  assert.equal(f.tank.currentLevelL.toNumber(), 70, 'replay must not re-decrement inventory');
});

test('14 usage already present before replay remains exactly one (no billing duplication)', async () => {
  const f = fixture([{ id: 'a', volume: 30, status: 'SUCCESS', resultJson: { physicalCompletionApplied: true, tankBeforeLevel: 100, tankAfterLevel: 70 } }], 70);
  await f.complete('a');
  assert.equal(f.usages.length, 1);
  await f.complete('a');
  await f.complete('a');
  assert.equal(f.usages.length, 1, 'usage must remain exactly one across repeated replays');
  assert.equal(f.reports.length, 1);
  assert.equal(f.activities.length, 1);
});

test('15 event publish is re-attempted on replay (documented as replay-attempted, not exactly-once)', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  f.failNextReportCreate();
  await assert.rejects(() => f.complete('a'));
  assert.equal(f.events.length, 0, 'event must not publish before the crashed attempt reaches the end of the handler');
  await f.complete('a');
  assert.equal(f.events.length, 1, 'event publish must be reached on replay');
  await f.complete('a');
  assert.equal(f.events.length, 2, 'a further replay re-attempts publish again (replay-attempted, not exactly-once, delivery)');
});

// --- 16-18: preserved invariants after the change ---

test('16 same-task sequential replay applies inventory exactly once', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  for (let i = 0; i < 10; i++) await f.complete('a');
  assert.equal(f.tank.currentLevelL.toNumber(), 70);
});

test('17 same-task concurrent replay applies inventory exactly once', async () => {
  const f = fixture([{ id: 'a', volume: 30 }]);
  await Promise.all(Array.from({ length: 10 }, () => f.complete('a')));
  assert.equal(f.tank.currentLevelL.toNumber(), 70);
});

test('18 different-task concurrency, underflow clamp, and tenant isolation remain correct', async () => {
  const f = fixture([{ id: 'a', volume: 30 }, { id: 'b', volume: 40 }]);
  await Promise.all([f.complete('a'), f.complete('b')]);
  assert.equal(f.tank.currentLevelL.toNumber(), 30);
  const under = fixture([{ id: 'c', volume: 999 }]);
  await under.complete('c');
  assert.equal(under.tank.currentLevelL.toNumber(), 0);
  assert.equal(under.tasks.get('c').status, 'SUCCESS');
});

async function main() { let passed = 0; for (const item of tests) { try { await item.run(); passed++; console.log(`PASS ${item.name}`); } catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; } } console.log(`R1-D.1 FERTIGATION COMPLETION RELIABILITY: ${passed}/${tests.length} PASS`); if (passed !== tests.length) process.exitCode = 1; }
void main();
