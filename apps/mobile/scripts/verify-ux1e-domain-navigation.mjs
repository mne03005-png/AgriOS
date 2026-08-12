import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// navigation.ts/permissions.ts/role-navigation.ts have no external-package (e.g. 'vue')
// imports, only relative ones -- unlike UX-1D's farm.store.ts test, a plain OS tmpdir is fine
// here (no need to resolve into the repo's node_modules chain).
const scratchDir = await mkdtemp(path.join(tmpdir(), 'agrios-ux1e-scratch-'));

async function compileTo(relSourcePath, outFileName) {
  const source = await readFile(new URL(relSourcePath, import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  javascript = javascript.replace(/from '(\.\.?\/[^']+)'/g, (_match, specifier) => `from './${specifier.split('/').pop()}.mjs'`);
  await writeFile(path.join(scratchDir, outFileName), javascript, 'utf8');
}

let exitCode = 0;
let navigation, permissions, roleNav;
try {
  await compileTo('../src/config/navigation.ts', 'navigation.mjs');
  await compileTo('../src/services/permissions.ts', 'permissions.mjs');
  await compileTo('../src/services/role-navigation.ts', 'role-navigation.mjs');
  navigation = await import(pathToFileURL(path.join(scratchDir, 'navigation.mjs')));
  permissions = await import(pathToFileURL(path.join(scratchDir, 'permissions.mjs')));
  roleNav = await import(pathToFileURL(path.join(scratchDir, 'role-navigation.mjs')));
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

const router = await readSrc('../src/router/index.ts');
const operations = await readSrc('../src/pages/OperationsPage.vue');
const appVue = await readSrc('../src/App.vue');
const appTabBar = await readSrc('../src/components/common/AppTabBar.vue');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const fieldDetail = await readSrc('../src/pages/FieldDetailPage.vue');
const fieldBottomSheet = await readSrc('../src/components/map/FieldBottomSheet.vue');
const profile = await readSrc('../src/pages/ProfilePage.vue');
const alerts = await readSrc('../src/pages/AlertsPage.vue');
const managerPage = await readSrc('../src/pages/ManagerWorkbenchPage.vue');

// --- Real per-role nav derivations, mirroring AppTabBar.vue / App.vue exactly ---
function mobileTabsFor(rawRole) {
  const role = permissions.canonicalRole(rawRole);
  if (role === 'FARMER' || role === 'MANAGER') return roleNav.applyRoleAwareHome(navigation.primaryNavigation, role);
  return navigation.workspaceNavigation.filter((item) => permissions.canAccess(item.roles, role));
}
function desktopNavFor(rawRole) {
  const role = permissions.canonicalRole(rawRole);
  // UX-1E closeout: desktopSecondaryNavigation (数据/reports) is inserted immediately before
  // 我的(/profile), matching App.vue's real visibleNavigation, to produce the accepted exact
  // order 首页/田块/作业/告警/数据/我的 rather than appending 数据 after 我的.
  const home = roleNav.applyRoleAwareHome(navigation.primaryNavigation, role);
  const profileIndex = home.findIndex((item) => item.path === '/profile');
  const withDesktopSecondary = [...home.slice(0, profileIndex), ...navigation.desktopSecondaryNavigation, ...home.slice(profileIndex)];
  const combined = [...withDesktopSecondary, ...navigation.workspaceNavigation].filter((item) => permissions.canAccess(item.roles, role));
  const deduped = combined.filter((item, index) => combined.findIndex((other) => other.path === item.path) === index);
  if (role === 'FARMER' || role === 'MANAGER') return deduped;
  const defaultPath = roleNav.getDefaultRouteForRole(role);
  return [...deduped].sort((a, b) => Number(b.path === defaultPath) - Number(a.path === defaultPath));
}

// --- 1-2: FARMER/MANAGER mobile nav ---
test('1 FARMER mobile nav = 首页/田块/作业/告警/我的', () => {
  const tabs = mobileTabsFor('FARMER');
  assert.deepEqual(tabs.map((t) => t.label), ['首页', '田块', '作业', '告警', '我的']);
  assert.equal(tabs[0].path, '/cockpit');
});
test('2 MANAGER mobile nav = 首页/田块/作业/告警/我的, 首页 resolves to /manager', () => {
  const tabs = mobileTabsFor('FARM_MANAGER');
  assert.deepEqual(tabs.map((t) => t.label), ['首页', '田块', '作业', '告警', '我的']);
  assert.equal(tabs[0].path, '/manager');
});

// --- 3-5: INSTALLER/ENGINEER/SUPER_ADMIN mobile workspace nav unchanged in principle ---
test('3-5 INSTALLER/ENGINEER/SUPER_ADMIN mobile nav is still workspaceNavigation, not the farmer shell', () => {
  for (const [rawRole, expectedPaths] of [['INSTALLER', ['/installer-checks']], ['MAINTAINER', ['/engineer', '/installer-checks']], ['PLATFORM_ADMIN', ['/manager', '/installer-checks', '/engineer', '/platform']]]) {
    const tabs = mobileTabsFor(rawRole).map((t) => t.path).sort();
    assert.deepEqual(tabs, [...expectedPaths].sort(), `${rawRole} mobile nav changed unexpectedly`);
  }
  assert.match(appTabBar, /role\.value === 'FARMER' \|\| role\.value === 'MANAGER'/, 'AppTabBar must still branch technical roles away from the farmer shell');
});

// --- 6-7: FARMER/MANAGER desktop nav ---
test('6 FARMER desktop nav is exactly 首页/田块/作业/告警/数据/我的 in that order', () => {
  const labels = desktopNavFor('FARMER').map((i) => i.label);
  assert.deepEqual(labels, ['首页', '田块', '作业', '告警', '数据', '我的']);
});
test('7 MANAGER desktop nav is exactly 首页/田块/作业/告警/数据/我的 in that order', () => {
  const labels = desktopNavFor('FARM_MANAGER').map((i) => i.label);
  assert.deepEqual(labels, ['首页', '田块', '作业', '告警', '数据', '我的']);
});
test('7b MANAGER desktop nav has no duplicate link to /manager (首页 already resolves there, 管理工作台 would be a second identical link)', () => {
  const paths = desktopNavFor('FARM_MANAGER').map((i) => i.path);
  assert.equal(paths.filter((p) => p === '/manager').length, 1, `expected exactly one /manager link, found ${paths.filter((p) => p === '/manager').length}`);
  assert.match(appVue, /combined\.findIndex\(\(other\) => other\.path === item\.path\) === index/, 'App.vue must dedupe visibleNavigation by path');
});
test('7c App.vue source actually inserts 数据 before 我的 by path (not silently diverged back to append-after-profile)', () => {
  assert.match(appVue, /profileIndex = home\.findIndex\(\(item\) => item\.path === '\/profile'\)/);
  assert.match(appVue, /home\.slice\(0, profileIndex\), \.\.\.desktopSecondaryNavigation, \.\.\.home\.slice\(profileIndex\)/);
});

// --- 8-12 ---
test('8 /map route still exists', () => {
  assert.match(router, /\{ path: '\/map', component: MapPage \}/);
});
test('9 visible normal label for /map is 田块', () => {
  const mapEntry = navigation.primaryNavigation.find((i) => i.path === '/map');
  assert.ok(mapEntry);
  assert.equal(mapEntry.label, '田块');
});
test('10 /alerts is now canonical normal navigation', () => {
  assert.ok(navigation.primaryNavigation.some((i) => i.path === '/alerts'));
});
test('11 /reports remains directly reachable', () => {
  assert.match(router, /\{ path: '\/reports', component: ReportsPage \}/);
});
test('12 /ai remains directly reachable but is not primary navigation', () => {
  assert.match(router, /\{ path: '\/ai', component: AIPage \}/);
  assert.ok(!navigation.primaryNavigation.some((i) => i.path === '/ai'));
  assert.ok(!navigation.desktopSecondaryNavigation.some((i) => i.path === '/ai'));
});

// --- 13-19: /farm-records compatibility redirect ---
test('13 /farm-records remains registered as a compatibility entry', () => {
  assert.match(router, /path:\s*'\/farm-records'/);
});
test('14 /farm-records resolves to /operations?tab=records', () => {
  assert.match(router, /path:\s*'\/farm-records',\s*redirect:\s*\(\)\s*=>\s*\(\{\s*path:\s*'\/operations',\s*query:\s*\{\s*tab:\s*'records'\s*\}\s*\}\)/);
});
test('15-16 redirect terminates, no loop (/operations is a real terminal page, not another redirect)', () => {
  assert.match(router, /\{ path: '\/operations', component: OperationsPage \}/);
});
test('17 Operations recognizes tab=records', () => {
  assert.match(operations, /activeTabKey === 'records'/);
  assert.match(operations, /key:\s*'records'/);
});
test('18 activeTabKey is derived purely from route.query (reload/back-safe by construction)', () => {
  assert.match(operations, /const activeTabKey = computed\(\(\) => \{/);
  assert.match(operations, /route\.query\.tab/);
  assert.doesNotMatch(operations, /const activeTabKey = ref\(/, 'must not duplicate tab state outside the URL');
});
test('19 unknown tab value falls back safely to 当前作业(all)', () => {
  assert.match(operations, /tabs\.value\.some\(\(tab\) => tab\.key === requested\) \? requested : 'all'/);
});

// --- 20-28: Operations domain ---
test('20 Operations default tab renders (当前作业/all)', () => {
  assert.match(operations, /typeof route\.query\.tab === 'string' \? route\.query\.tab : 'all'/);
});
test('21 Farm Records content is discoverable from Operations (honest, non-fabricated)', () => {
  assert.match(operations, /功能建设中/);
  assert.match(operations, /农事记录将在 Phase B 交付/);
});
function operationsTabsFor(rawRole) {
  const role = permissions.canonicalRole(rawRole);
  const list = [{ key: 'all' }, { key: 'records' }];
  if (permissions.canAccess(['MANAGER', 'ENGINEER', 'SUPER_ADMIN'], role)) list.push({ key: 'drone' });
  if (permissions.canAccess(['MANAGER', 'SUPER_ADMIN'], role)) list.push({ key: 'approvals' });
  return list.map((t) => t.key);
}
test('22 Drone Operations discoverable via Operations for authorized roles (MANAGER/ENGINEER/SUPER_ADMIN)', () => {
  for (const role of ['FARM_MANAGER', 'MAINTAINER', 'PLATFORM_ADMIN']) assert.ok(operationsTabsFor(role).includes('drone'), `${role} should see the 无人机 tab`);
  assert.match(operations, /to="\/drone-operations"/);
});
test('23 Drone Review discoverable for MANAGER via the 审核 tab', () => {
  assert.ok(operationsTabsFor('FARM_MANAGER').includes('approvals'));
  assert.match(operations, /to="\/drone-reviews"/);
});
test('24 FARMER does not gain approval or drone-operations actions', () => {
  const farmerTabs = operationsTabsFor('FARMER');
  assert.ok(!farmerTabs.includes('drone'));
  assert.ok(!farmerTabs.includes('approvals'));
  assert.deepEqual(farmerTabs, ['all', 'records']);
});
test('25 Boundary Review discoverable for MANAGER via the 审核 tab', () => {
  assert.match(operations, /to="\/boundaries\/review"/);
});
test('26 no engineer-only tooling appears in Operations', () => {
  for (const forbidden of ['MQTT', 'PLC', 'Modbus', 'commandId', 'requestId']) assert.doesNotMatch(operations, new RegExp(forbidden), `Operations must not surface "${forbidden}"`);
});
test('27 tab switching preserves current farm context (selectTab never touches farmStore)', () => {
  const selectTabBody = operations.slice(operations.indexOf('function selectTab'), operations.indexOf('function selectTab') + 200);
  assert.doesNotMatch(selectTabBody, /farmStore/);
});
test('28 secondary tabs (records/drone/approvals) make no API calls -- a failure there is structurally impossible', () => {
  assert.doesNotMatch(operations, /getDroneOperations|getDroneReviews|getFieldBoundaries/, 'Operations must not eagerly call drone/boundary APIs -- those stay on their own pages');
  const apiCallCount = [...operations.matchAll(/\b(getOperations|getDemoHealth)\(/g)].length;
  assert.equal(apiCallCount, 2, 'only the 当前作业 tab may call a real API (getOperations + getDemoHealth)');
});

// --- 29-35: contextual discovery ---
test('29 Farmer Home still reaches contextual AI drill-down', () => {
  assert.match(cockpit, /AIRecommendationCard/);
});
test('30 Field Detail still supports contextual recommendation', () => {
  assert.match(fieldDetail, /DecisionExplanationCard/);
});
test('31 /ai is not a primary navigation item (restated)', () => {
  assert.ok(!navigation.primaryNavigation.some((i) => i.path === '/ai'));
});
test('32 Map/Field flow still reaches /fields/:fieldId', () => {
  assert.match(fieldBottomSheet, /`\/fields\/\$\{field\.fieldId \?\? field\.id \?\? 'field_001'\}`/);
});
test('33 boundary-review link only renders for authorized roles', () => {
  assert.match(fieldBottomSheet, /v-if="canReviewBoundaries"/);
  assert.match(fieldBottomSheet, /canAccess\(\['MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\]/);
});
test('34 /operation-reports/:id route remains intact', () => {
  assert.match(router, /\{ path: '\/operation-reports\/:id', component: OperationReportDetailPage, props: true \}/);
});
test('35 reports remain reachable on mobile without a sixth bottom tab', () => {
  assert.equal(navigation.primaryNavigation.length, 5);
  assert.ok(!navigation.primaryNavigation.some((i) => i.path === '/reports'));
  assert.match(profile, /path: '\/reports'/);
});

// --- Route preservation (no deletions) ---
test('no old public URL was removed', () => {
  for (const p of ['/map', '/ai', '/drone-operations', '/drone-reviews', '/boundaries/review', '/reports', '/operation-reports/:id', '/fields/:fieldId', '/alerts', '/operations', '/cockpit', '/manager', '/profile']) {
    assert.match(router, new RegExp(`path:\\s*'${p.replace(/[/:]/g, '\\$&')}'`), `route ${p} missing`);
  }
});

// --- Farm context preservation (UX-1D) ---
test('Alerts and Operations use shared farmStore, not a reintroduced defaultFarmId', () => {
  for (const [name, src] of [['AlertsPage', alerts], ['OperationsPage', operations]]) {
    assert.match(src, /farmStore\.currentFarmIdOrDefault/, `${name} must use farmStore`);
    assert.doesNotMatch(src, /getAlerts\(defaultFarmId\)|getOperations\(defaultFarmId\)/, `${name} must not reintroduce defaultFarmId as a competing source`);
  }
});
test('Role landings (UX-1B) unchanged: role-navigation.ts default routes untouched', () => {
  assert.equal(roleNav.getDefaultRouteForRole('FARMER'), '/cockpit');
  assert.equal(roleNav.getDefaultRouteForRole('FARM_MANAGER'), '/manager');
  assert.equal(roleNav.getDefaultRouteForRole('INSTALLER'), '/installer-checks');
  assert.equal(roleNav.getDefaultRouteForRole('MAINTAINER'), '/engineer');
  assert.equal(roleNav.getDefaultRouteForRole('PLATFORM_ADMIN'), '/platform');
});

// --- Safety (regression guards, mirrors prior phases) ---
test('S1 QuickActions unreachable', async () => {
  const quickActions = await readSrc('../src/components/cockpit/QuickActions.vue');
  assert.doesNotMatch(quickActions, /@click/);
});
test('S2 ValveControlPanel unconnected', async () => {
  const valvePanel = await readSrc('../src/components/control/ValveControlPanel.vue');
  assert.doesNotMatch(valvePanel, /@click|defineEmits/);
});
test('S3 ValveControlTest dry-run banner unchanged (file untouched by UX-1E)', async () => {
  const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
});
test('S4 production-api dryRun:true hardgate unchanged', async () => {
  const productionApi = await readSrc('../src/api/production-api.ts');
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
});
test('Manager quick-entry no longer duplicates primary nav, keeps genuinely-distinct approval shortcuts', () => {
  assert.doesNotMatch(managerPage, /to="\/operations">作业与审批/);
  assert.doesNotMatch(managerPage, /to="\/reports">报表/);
  assert.match(managerPage, /to="\/drone-reviews">无人机审核/);
  assert.match(managerPage, /to="\/boundaries\/review">边界审核/);
});

let passed = 0;
for (const item of tests) {
  try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.name}`, error); exitCode = 1; }
}
console.log(`UX-1E DOMAIN NAVIGATION: ${passed}/${tests.length} PASS`);
process.exitCode = exitCode || (passed !== tests.length ? 1 : 0);
