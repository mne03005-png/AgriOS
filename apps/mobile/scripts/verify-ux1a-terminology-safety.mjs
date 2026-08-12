import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(relPath) {
  const source = await readFile(new URL(relPath, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

const statusModule = await loadModule('../src/services/status-translation.ts');
const errorModule = await loadModule('../src/api/api-error.ts');
const permissionsModule = await loadModule('../src/services/permissions.ts');

const tests = [];
const test = (name, run) => tests.push({ name, run });

// --- Status translation foundation ---
test('1 confirmed lifecycle statuses translate to Chinese', () => {
  assert.equal(statusModule.translateStatusLabel('QUEUED'), '等待执行');
  assert.equal(statusModule.translateStatusLabel('PENDING_APPROVAL'), '需要审批');
  assert.equal(statusModule.translateStatusLabel('FAILED'), '执行失败');
  assert.equal(statusModule.translateStatusLabel('OUTCOME_UNKNOWN'), '结果待确认');
  assert.equal(statusModule.translateStatusLabel('FEEDBACK_PENDING'), '等待设备反馈');
  assert.equal(statusModule.translateStatusLabel('OFFLINE'), '离线');
});
test('2 OFFLINE, UNKNOWN, FEEDBACK_PENDING and OUTCOME_UNKNOWN remain distinct (not collapsed)', () => {
  const values = ['OFFLINE', 'UNKNOWN', 'FEEDBACK_PENDING', 'OUTCOME_UNKNOWN'].map((code) => statusModule.translateStatusLabel(code));
  assert.equal(new Set(values).size, 4, 'expected 4 distinct Chinese labels, found a collapse');
});
test('3 confirmed severity/review statuses translate to Chinese', () => {
  assert.equal(statusModule.translateStatusLabel('MEDIUM'), '中等');
  assert.equal(statusModule.translateStatusLabel('ANOMALY'), '异常');
  assert.equal(statusModule.translateStatusLabel('CANDIDATE'), '待审核');
  assert.equal(statusModule.translateStatusLabel('APPROVED'), '已批准');
  assert.equal(statusModule.translateStatusLabel('REJECTED'), '已拒绝');
});
test('4 unrecognized backend status does not crash and falls back to the raw code', () => {
  assert.doesNotThrow(() => statusModule.translateStatusLabel('SOME_FUTURE_BACKEND_CODE'));
  assert.equal(statusModule.translateStatusLabel('SOME_FUTURE_BACKEND_CODE'), 'SOME_FUTURE_BACKEND_CODE');
});
test('5 null/undefined status does not crash and has a safe fallback', () => {
  assert.doesNotThrow(() => statusModule.translateStatusLabel(undefined));
  assert.equal(statusModule.translateStatusLabel(undefined), '未知');
  assert.equal(statusModule.translateStatusLabel(null), '未知');
  assert.equal(statusModule.translateStatusLabel(''), '未知');
});

// --- Structured error UX (R1-C contract preserved + extended) ---
const structured = (errorCode) => JSON.stringify({ errorCode, message: 'fallback-should-not-be-used', reasons: [errorCode] });
test('6 PUMP_INTERLOCK_BLOCKED has normal-user Chinese explanation', () => {
  const value = errorModule.parseApiErrorText(403, structured('PUMP_INTERLOCK_BLOCKED'));
  assert.equal(value.errorCode, 'PUMP_INTERLOCK_BLOCKED');
  assert.match(value.message, /[一-龥]/);
  assert.notEqual(value.message, 'fallback-should-not-be-used');
});
test('7 STOP_PUMP_BEFORE_VALVE_CLOSE has normal-user Chinese explanation', () => {
  const value = errorModule.parseApiErrorText(403, structured('STOP_PUMP_BEFORE_VALVE_CLOSE'));
  assert.equal(value.errorCode, 'STOP_PUMP_BEFORE_VALVE_CLOSE');
  assert.match(value.message, /[一-龥]/);
  assert.notEqual(value.message, 'fallback-should-not-be-used');
});
test('8 pre-existing safety/control error mappings remain intact', () => {
  assert.equal(errorModule.parseApiErrorText(403, structured('EMERGENCY_STOP_ACTIVE')).message, '急停已激活，当前禁止执行该操作。');
  assert.equal(errorModule.parseApiErrorText(403, structured('REAL_CONTROL_DISABLED')).message, '真实设备控制当前未启用。');
  assert.equal(errorModule.parseApiErrorText(403, structured('VALVE_OFFLINE')).message, '阀门设备当前离线。');
  assert.equal(errorModule.parseApiErrorText(403, structured('OUTCOME_UNKNOWN')).message, '设备执行结果暂时无法确认，请勿重复操作并等待人工核查。');
});
test('9 technical diagnostic fields are not the primary message', () => {
  const value = errorModule.parseApiErrorText(403, JSON.stringify({ errorCode: 'PUMP_INTERLOCK_BLOCKED', requestId: 'req-1', commandId: 'cmd-1', actionPlanId: 'plan-1', queueJobId: 'job-1', deviceId: 'device-1' }));
  assert.doesNotMatch(value.message, /req-1|cmd-1|plan-1|job-1|device-1/);
  assert.equal(value.requestId, 'req-1');
  assert.equal(value.commandId, 'cmd-1');
});
test('10 unknown error code does not crash and has a safe generic fallback', () => {
  assert.doesNotThrow(() => errorModule.parseApiErrorText(500, structured('SOME_FUTURE_ERROR_CODE')));
  const value = errorModule.parseApiErrorText(500, structured('SOME_FUTURE_ERROR_CODE'));
  assert.equal(typeof value.message, 'string');
  assert.ok(value.message.length > 0);
});

// --- Role-source correctness (ReadOnlyTelemetryPage fix, canonical architecture) ---
test('11 PLATFORM_ADMIN legacy role resolves to canonical SUPER_ADMIN', () => {
  assert.equal(permissionsModule.canonicalRole('PLATFORM_ADMIN'), 'SUPER_ADMIN');
});
test('12 TENANT_ADMIN legacy role does not resolve to SUPER_ADMIN (admin-only panel stays admin-only)', () => {
  assert.notEqual(permissionsModule.canonicalRole('TENANT_ADMIN'), 'SUPER_ADMIN');
  assert.equal(permissionsModule.canonicalRole('TENANT_ADMIN'), 'MANAGER');
});
test('13 missing/unknown role does not crash canonicalRole and safely defaults to FARMER', () => {
  assert.doesNotThrow(() => permissionsModule.canonicalRole(undefined));
  assert.equal(permissionsModule.canonicalRole(undefined), 'FARMER');
  assert.equal(permissionsModule.canonicalRole('SOME_UNKNOWN_ROLE'), 'FARMER');
});
test('14 ReadOnlyTelemetryPage no longer reads the unpopulated localStorage role key', async () => {
  const source = await readFile(new URL('../src/pages/ReadOnlyTelemetryPage.vue', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage\.getItem\('agrios_user_role'\)/, 'dead localStorage key must not be read again');
  assert.match(source, /canonicalRole\(/, 'must derive admin visibility from the canonical role source');
  assert.match(source, /authStore/, 'must derive admin visibility from the shared auth store');
});

// --- Safety freeze regression guards: inert controls must stay inert ---
test('15 QuickActions emergency-stop and valve buttons remain disabled with no click wiring', async () => {
  const source = await readFile(new URL('../src/components/cockpit/QuickActions.vue', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@click/, 'QuickActions must not gain any click wiring in UX-1A');
  const disabledButtons = [...source.matchAll(/<button[^>]*disabled[^>]*>/g)];
  assert.ok(disabledButtons.length >= 3, 'expected emergency-stop, valve and auto-mode buttons to remain disabled');
});
test('16 ValveControlPanel buttons remain disabled with no click/emit wiring', async () => {
  const source = await readFile(new URL('../src/components/control/ValveControlPanel.vue', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@click|defineEmits/, 'ValveControlPanel must not gain click or emit wiring in UX-1A');
  const disabledButtons = [...source.matchAll(/<button[^>]*disabled[^>]*>/g)];
  assert.equal(disabledButtons.length, 2, 'expected exactly the open/close disabled buttons');
});
test('17 production-api dryRun:true hardgate is unchanged', async () => {
  const source = await readFile(new URL('../src/api/production-api.ts', import.meta.url), 'utf8');
  const dryRunCount = [...source.matchAll(/dryRun:\s*true/g)].length;
  assert.ok(dryRunCount >= 3, 'expected all valve dry-run POST helpers to still hardcode dryRun:true');
  assert.doesNotMatch(source, /dryRun:\s*false/);
});

let passed = 0;
for (const item of tests) {
  try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; }
}
console.log(`UX-1A TERMINOLOGY/SAFETY: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
