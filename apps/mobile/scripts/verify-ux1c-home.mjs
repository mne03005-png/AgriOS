import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(relPath) {
  const source = await readFile(new URL(relPath, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

const homeSummary = await loadModule('../src/services/home-summary.ts');

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const manager = await readSrc('../src/pages/ManagerWorkbenchPage.vue');
const routerSource = await readSrc('../src/router/index.ts');
const mobileCss = await readSrc('../src/styles/mobile.css');

// --- home-summary.ts pure-logic correctness ---
test('1 deriveFieldAttention only surfaces fields with a real HIGH/CRITICAL alert tied to a real field', () => {
  const fields = [{ id: 'field-a', name: '洋葱1号田' }, { id: 'field-b', name: '洋葱2号田' }];
  const alerts = { safetyAlerts: [{ fieldId: 'field-a', severity: 'HIGH' }], anomalies: [{ fieldId: 'field-b', severity: 'LOW' }, { fieldId: 'field-unknown', severity: 'CRITICAL' }] };
  const result = homeSummary.deriveFieldAttention(fields, alerts);
  assert.deepEqual(result, [{ fieldId: 'field-a', fieldName: '洋葱1号田', severity: 'HIGH' }]);
});
test('2 deriveFieldAttention never fabricates a field that is not in the real field list', () => {
  const result = homeSummary.deriveFieldAttention([{ id: 'field-a', name: 'A' }], { safetyAlerts: [{ fieldId: 'field-ghost', severity: 'CRITICAL' }] });
  assert.deepEqual(result, []);
});
test('3 deriveFieldAttention does not crash on missing/empty inputs', () => {
  assert.doesNotThrow(() => homeSummary.deriveFieldAttention(undefined, undefined));
  assert.deepEqual(homeSummary.deriveFieldAttention(undefined, undefined), []);
});
test('4 countFieldsOk is truthful arithmetic over the real field list', () => {
  const fields = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const attention = [{ fieldId: 'a', fieldName: 'A', severity: 'HIGH' }];
  assert.deepEqual(homeSummary.countFieldsOk(fields, attention), { total: 3, attention: 1, ok: 2 });
});
test('5 formatFreshness only ever renders from a real timestamp, never invents one', () => {
  assert.equal(homeSummary.formatFreshness(null), null);
  assert.equal(homeSummary.formatFreshness(undefined), null);
  assert.equal(homeSummary.formatFreshness(new Date(Date.now() - 5 * 60_000).toISOString()), '更新于 5 分钟前');
});

// --- FARMER HOME (CockpitPage.vue) ---
test('6 renders a clear primary status section as the first content panel', () => {
  const afterHeader = cockpit.slice(cockpit.indexOf('FarmStatusHeader'));
  assert.match(afterHeader.slice(0, 400), /今日状态/, 'the first panel after farm context must be the status summary');
});
// Strip Vue bindings (:prop="...", v-xxx="...", {{ interpolation }}) so forbidden-term checks
// only scan static, user-visible text -- not prop/variable names like `latestActionPlans`.
function staticTextOnly(template) {
  return template
    .replace(/:[a-zA-Z-]+="[^"]*"/g, '')
    .replace(/v-[a-zA-Z-]+(="[^"]*")?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}
const cockpitStaticText = staticTextOnly(cockpit);
const managerStaticText = staticTextOnly(manager);

test('7 does not expose raw technical terminology as primary Home copy', () => {
  for (const forbidden of ['ActionPlan', 'ActionQueue', 'MQTT', 'PLC ', 'Modbus', 'commandId', 'requestId', 'queueJobId']) {
    assert.doesNotMatch(cockpitStaticText, new RegExp(forbidden), `Farmer Home must not surface "${forbidden}" as primary copy`);
  }
});
test('8 AI recommendation is advisory-only: no execution wiring added on Home', () => {
  assert.doesNotMatch(cockpitStaticText, /审批执行|执行建议/, 'CockpitPage must not add AI/action execution copy');
  assert.doesNotMatch(cockpit, /onEmergencyStop|onValve|emergencyStop\(|controlValve\(/, 'no physical-control handler may be wired on Farmer Home');
});
test('9 field attention links preserve /fields/:fieldId', () => {
  assert.match(cockpit, /`\/fields\/\$\{item\.fieldId\}`/);
});
test('10 alerts link preserves /alerts', () => {
  assert.match(cockpit, /to="\/alerts"/);
});
test('11 mock data is visibly labeled 模拟数据, never raw "Mock"', () => {
  assert.match(cockpit, /模拟数据/);
  assert.doesNotMatch(cockpit, /\bMock\b/);
});
test('12 QuickActions is present but demoted (rendered last, after status/attention content)', () => {
  const quickActionsIndex = cockpit.indexOf('<QuickActions');
  const statusIndex = cockpit.indexOf('今日状态');
  assert.ok(quickActionsIndex > statusIndex, 'QuickActions must render after the primary status section, not before it');
});

// --- MANAGER HOME (ManagerWorkbenchPage.vue) ---
test('13 renders manager-specific heading/content', () => {
  for (const expected of ['农场状态', '待处理', '快速入口']) assert.match(manager, new RegExp(expected));
});
test('14 links to existing manager-relevant workflows that resolve to real registered routes', () => {
  // UX-1E made 作业(/operations) and 数据(/reports) primary navigation items, one tap away --
  // ManagerWorkbenchPage's own quick-entry shortcuts to them became duplicate discovery and
  // were intentionally removed there (see UX-1E section 21; verify-ux1e-domain-navigation.mjs
  // covers primary-nav reachability). The two approval-queue shortcuts remain genuinely
  // distinct (still two taps away via 作业 -> 审核) and are still expected here.
  const routesArrayBody = routerSource.match(/routes:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/)[1];
  const routePaths = [...routesArrayBody.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);
  for (const target of ['/drone-reviews', '/boundaries/review']) {
    assert.match(manager, new RegExp(`to="${target.replace('/', '\\/')}"`), `Manager Home must link to ${target}`);
    assert.ok(routePaths.includes(target), `${target} must still be a real registered route`);
  }
});
test('15 no engineer-only tooling is surfaced on Manager Home', () => {
  for (const forbidden of ['/engineer', '/valve-control-test', '/device-integration', '/edge-gateways', 'to="/devices"', 'PLC', 'MQTT', 'Modbus']) {
    assert.doesNotMatch(manager, new RegExp(forbidden.replace('/', '\\/')), `Manager Home must not surface engineer-only tooling: ${forbidden}`);
  }
});
test('16 no fake implemented team-management action appears (still honestly labeled, not wired)', () => {
  assert.match(manager, /功能建设中，尚未开放/);
  assert.doesNotMatch(manager, /@click="[^"]*(team|zone|成员|Zone)/i);
});
test('17 approval route guards (role meta) are unchanged from the accepted baseline', () => {
  assert.match(routerSource, /\{ path: '\/drone-reviews', component: DroneReviewPage, meta: \{ roles: \['MANAGER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.match(routerSource, /\{ path: '\/boundaries\/review', component: BoundaryReviewPage, meta: \{ roles: \['MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('18 partial secondary-data failure cannot crash the whole Manager Home (Promise.allSettled, independent status checks)', () => {
  assert.match(manager, /Promise\.allSettled/);
  assert.doesNotMatch(manager, /await Promise\.all\(/, 'must not use Promise.all, which rejects the whole batch on one failure');
  const fulfilledChecks = [...manager.matchAll(/\.status === 'fulfilled'/g)].length;
  assert.ok(fulfilledChecks >= 3, 'each of the secondary API results must be checked independently before use');
});

// --- RESPONSIVE ---
test('19 dashboard-grid has no forced multi-column at mobile width (single-column priority flow)', () => {
  const baseRule = mobileCss.match(/\.dashboard-grid \{ display: grid; gap: 14px; \}/);
  assert.ok(baseRule, 'base .dashboard-grid rule must not set grid-template-columns (mobile defaults to a single implicit column)');
});
test('20 dashboard-grid becomes 2-column at both tablet and desktop widths', () => {
  const tabletBlock = mobileCss.match(/@media \(min-width: 768px\) and \(max-width: 1199px\) \{([\s\S]*?)\n\}/)[1];
  const desktopBlock = mobileCss.match(/@media \(min-width: 1200px\) \{([\s\S]*?)\n\}/)[1];
  assert.match(tabletBlock, /\.dashboard-grid/);
  assert.match(desktopBlock, /\.dashboard-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});

// --- SAFETY ---
test('21 QuickActions buttons remain disabled with no wiring (regression guard, mirrors UX-1A)', async () => {
  const quickActions = await readSrc('../src/components/cockpit/QuickActions.vue');
  assert.doesNotMatch(quickActions, /@click/);
  assert.equal([...quickActions.matchAll(/<button[^>]*disabled[^>]*>/g)].length, 3);
});
test('22 ValveControlPanel and FieldDetailPage remain untouched/unreachable', async () => {
  const valvePanel = await readSrc('../src/components/control/ValveControlPanel.vue');
  const fieldDetail = await readSrc('../src/pages/FieldDetailPage.vue');
  assert.doesNotMatch(valvePanel, /@click|defineEmits/);
  assert.equal([...valvePanel.matchAll(/<button[^>]*disabled[^>]*>/g)].length, 2);
  assert.match(fieldDetail, /<ValveControlPanel @command="onValve" \/>/);
});
test('23 ValveControlTest dry-run banner is unchanged (file untouched by UX-1C)', async () => {
  const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
  for (const fn of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening']) {
    assert.match(valveTest, new RegExp(fn), `must still call the dryRun-hardcoded production-api helper ${fn}, not a raw control endpoint`);
  }
});
test('24 production-api dryRun:true hardgate is unchanged', async () => {
  const productionApi = await readSrc('../src/api/production-api.ts');
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
});

let passed = 0;
for (const item of tests) {
  try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; }
}
console.log(`UX-1C FARMER/MANAGER HOME: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
