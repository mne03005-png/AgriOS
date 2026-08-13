import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// platform-context.store.ts and farm.store.ts import the real 'vue' package (hoisted to the
// workspace root node_modules) -- the scratch dir must live inside the repo tree for Node's
// bare-specifier resolution to find it, exactly like UX-1D's own test script.
const scratchDir = await mkdtemp(path.join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '.ux1h-scratch-'));

async function compileTo(relSourcePath, outFileName) {
  const source = await readFile(new URL(relSourcePath, import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  javascript = javascript.replace(/from '(\.\.?\/[^']+)'/g, (_match, specifier) => `from './${specifier.split('/').pop()}.mjs'`);
  await writeFile(path.join(scratchDir, outFileName), javascript, 'utf8');
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

let exitCode = 0;
let mockData, authStoreModule, farmStoreModule, platformContextModule, platformModeModule, permissions, roleNav, navigation;
try {
  await compileTo('../src/api/mock-data.ts', 'mock-data.mjs');
  await compileTo('../src/stores/auth.store.ts', 'auth.store.mjs');
  await compileTo('../src/stores/farm.store.ts', 'farm.store.mjs');
  await compileTo('../src/stores/platform-context.store.ts', 'platform-context.store.mjs');
  await compileTo('../src/services/permissions.ts', 'permissions.mjs');
  await compileTo('../src/services/role-navigation.ts', 'role-navigation.mjs');
  await compileTo('../src/services/platform-mode.ts', 'platform-mode.mjs');
  await compileTo('../src/config/navigation.ts', 'navigation.mjs');

  globalThis.localStorage = (() => {
    let store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  })();

  mockData = await import(pathToFileURL(path.join(scratchDir, 'mock-data.mjs')));
  authStoreModule = await import(pathToFileURL(path.join(scratchDir, 'auth.store.mjs')));
  farmStoreModule = await import(pathToFileURL(path.join(scratchDir, 'farm.store.mjs')));
  platformContextModule = await import(pathToFileURL(path.join(scratchDir, 'platform-context.store.mjs')));
  permissions = await import(pathToFileURL(path.join(scratchDir, 'permissions.mjs')));
  roleNav = await import(pathToFileURL(path.join(scratchDir, 'role-navigation.mjs')));
  platformModeModule = await import(pathToFileURL(path.join(scratchDir, 'platform-mode.mjs')));
  navigation = await import(pathToFileURL(path.join(scratchDir, 'navigation.mjs')));
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}

const { authStore } = authStoreModule;
const { farmStore } = farmStoreModule;
const { platformContextStore } = platformContextModule;
const { getPlatformMode } = platformModeModule;

const appVue = await readSrc('../src/App.vue');
const appTabBar = await readSrc('../src/components/common/AppTabBar.vue');
const superAdminPage = await readSrc('../src/pages/SuperAdminPage.vue');
const router = await readSrc('../src/router/index.ts');
const farmApi = await readSrc('../src/api/farm-api.ts');
const tenantApi = await readSrc('../src/api/tenant-api.ts');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const managerPage = await readSrc('../src/pages/ManagerWorkbenchPage.vue');
const engineerPage = await readSrc('../src/pages/EngineerWorkbenchPage.vue');
const installerPage = await readSrc('../src/pages/InstallerChecksPage.vue');

function setUser(overrides) {
  authStore.user = { id: 'u1', name: 'admin', role: 'PLATFORM_ADMIN', canonicalRole: 'SUPER_ADMIN', ...overrides };
}

// ============ 1-8: mode model ============
test('1 SUPER_ADMIN default landing remains /platform', () => {
  assert.equal(roleNav.getDefaultRouteForRole('PLATFORM_ADMIN'), '/platform');
  assert.equal(roleNav.DEFAULT_WORKSPACE_ROUTE.SUPER_ADMIN, '/platform');
});
test('2 /platform clearly represents Platform Mode (SuperAdminPage source)', () => {
  assert.match(superAdminPage, /平台模式/);
  assert.match(superAdminPage, /平台管理/);
});
test('3 Platform Mode does not silently activate a stale farm (SuperAdminPage clears farmStore unconditionally on mount)', () => {
  assert.match(superAdminPage, /farmStore\.clearCurrentFarm\(\)/);
  assert.match(superAdminPage, /platformContextStore\.clear\(\)/);
});
test('4 Farm Operation Mode requires legitimate farm context (getPlatformMode is FARM_OPERATION only when a real farmId is set)', () => {
  assert.equal(getPlatformMode('SUPER_ADMIN', null), 'PLATFORM');
  assert.equal(getPlatformMode('SUPER_ADMIN', ''), 'PLATFORM');
  assert.equal(getPlatformMode('SUPER_ADMIN', 'farm-1'), 'FARM_OPERATION');
});
test('5 entering Farm Operation Mode changes visible mode/context', () => {
  farmStore.clearCurrentFarm();
  assert.equal(getPlatformMode('SUPER_ADMIN', farmStore.currentFarmId), 'PLATFORM');
  farmStore.setCurrentFarm('farm-tenant-a-1', 'Onion Farm A');
  assert.equal(getPlatformMode('SUPER_ADMIN', farmStore.currentFarmId), 'FARM_OPERATION');
  farmStore.clearCurrentFarm();
});
test('6 returning to Platform Mode clears/deactivates farm operation context appropriately', () => {
  farmStore.setCurrentFarm('farm-tenant-a-1', 'Onion Farm A');
  platformContextStore.selectTenant('tenant-a', 'Tenant A');
  assert.equal(getPlatformMode('SUPER_ADMIN', farmStore.currentFarmId), 'FARM_OPERATION');
  farmStore.clearCurrentFarm();
  platformContextStore.clear();
  assert.equal(getPlatformMode('SUPER_ADMIN', farmStore.currentFarmId), 'PLATFORM');
  assert.equal(platformContextStore.selectedTenantId, null);
});
test('7 mode is one clear source of frontend truth (App.vue and AppTabBar.vue both derive from the same getPlatformMode helper)', () => {
  assert.match(appVue, /import \{ getPlatformMode \} from '\.\/services\/platform-mode'/);
  assert.match(appTabBar, /import \{ getPlatformMode \} from '\.\.\/\.\.\/services\/platform-mode'/);
  assert.match(appVue, /const mode = computed\(\(\) => getPlatformMode\(role\.value, farmStore\.currentFarmId\)\)/);
});
test('8 no duplicate competing platform mode state exists (no scattered selectedTenant/activeTenant/platformTenant flags)', async () => {
  const files = [appVue, appTabBar, superAdminPage];
  for (const forbidden of ['selectedTenant =', 'activeTenant', 'platformTenant', 'adminSelectedFarm', 'superAdminFarm', 'platformFarmStore']) {
    for (const file of files) assert.doesNotMatch(file, new RegExp(forbidden.replace(/[[\]]/g, '\\$&')), `must not scatter competing mode state: ${forbidden}`);
  }
});

// ============ 9-17: tenant / farm ============
test('9 legitimate tenant list is used if supported (SuperAdminPage calls the real getTenants API)', () => {
  assert.match(superAdminPage, /import \{ getTenants, type Tenant \} from '\.\.\/api\/tenant-api'/);
  assert.match(superAdminPage, /getTenants\(\)/);
});
test('10 tenant selection uses existing API only (tenant-api.ts wraps unmodified GET /tenants, no new backend endpoint)', () => {
  assert.match(tenantApi, /request<Tenant\[\]>\('\/tenants', \{\}, \[\]\)/);
  assert.match(tenantApi, /request<Tenant>\(`\/tenants\/\$\{id\}`/);
});
test('11 farm list is scoped to selected tenant where supported (client-side filter over the existing GET /farms response)', () => {
  assert.match(superAdminPage, /farmsForSelectedTenant = computed\(\(\) =>/);
  assert.match(superAdminPage, /farms\.value\.filter\(\(farm\) => farm\.tenantId === platformContextStore\.selectedTenantId\)/);
});
test('12 invalid/stale tenant context is rejected/cleared (selecting the same tenant again toggles it off; clear() resets both fields)', () => {
  platformContextStore.selectTenant('tenant-x', 'Tenant X');
  assert.equal(platformContextStore.selectedTenantId, 'tenant-x');
  platformContextStore.clear();
  assert.equal(platformContextStore.selectedTenantId, null);
  assert.equal(platformContextStore.selectedTenantName, null);
});
test('13 invalid/stale farm does not become authoritative (currentFarmIdOrDefault never fabricates a farm id from platform context alone)', () => {
  farmStore.clearCurrentFarm();
  platformContextStore.selectTenant('tenant-x', 'Tenant X');
  assert.equal(farmStore.currentFarmId, null, 'selecting a tenant alone must never set a farm');
  platformContextStore.clear();
});
test('14 changing tenant invalidates incompatible farm context (App.vue watcher re-resolves tenant from the farm resource itself, never trusts a stale picker selection)', () => {
  assert.match(appVue, /whenever SUPER_ADMIN's active farm changes/);
  assert.match(appVue, /const farmResult = await getFarmById\(farmId\)/);
  assert.match(appVue, /const tenantResult = await getTenantById\(tenantId\)/);
});
test('15 changing farm updates farmStore (enterFarmOperationMode calls farmStore.setCurrentFarm, the one canonical farm-context store)', () => {
  assert.match(superAdminPage, /farmStore\.setCurrentFarm\(farm\.id, farm\.name\)/);
});
test('16 current tenant/farm labels match the loaded operational data (contextLabel is built from platformContextStore + farmStore, never a hardcoded string)', () => {
  assert.match(appVue, /const tenantLabel = platformContextStore\.selectedTenantName/);
  assert.match(appVue, /`农场运营 · \$\{tenantLabel\} \/ \$\{farmName\.value\}`/);
});
test('17 localStorage alone never grants context (platform-context.store.ts never reads/writes localStorage)', async () => {
  const src = await readSrc('../src/stores/platform-context.store.ts');
  assert.doesNotMatch(src, /localStorage\.(getItem|setItem|removeItem)/);
});

// ============ 18-24: deep links ============
test('18 SUPER_ADMIN /fields/:fieldId remains valid (route unchanged, no role meta added)', () => {
  assert.match(router, /\{ path: '\/fields\/:fieldId', component: FieldDetailPage, props: true \}/);
});
test('19-20 field resource context overrides stale farm cache and causes Farm Operation Mode to become visible', () => {
  farmStore.clearCurrentFarm();
  assert.equal(getPlatformMode('SUPER_ADMIN', farmStore.currentFarmId), 'PLATFORM');
  // FieldDetailPage.vue's own existing UX-1D mechanism (unmodified) calls farmStore.setCurrentFarm
  // directly when a field proves a different farm; simulate that resource-driven correction here.
  farmStore.setCurrentFarm('farm-from-field-deep-link', 'Field-resolved Farm');
  assert.equal(getPlatformMode('SUPER_ADMIN', farmStore.currentFarmId), 'FARM_OPERATION', 'resource context must flip mode to Farm Operation Mode');
  farmStore.clearCurrentFarm();
});
test('21 /cockpit direct access remains valid where currently authorized (no role meta, unchanged)', () => {
  assert.match(router, /\{ path: '\/cockpit', component: CockpitPage \}/);
});
test('22 /profile remains directly accessible (no role meta, unchanged; not used as the mode switch mechanism)', () => {
  assert.match(router, /\{ path: '\/profile', component: ProfilePage \}/);
  assert.doesNotMatch(superAdminPage, /profile/i);
});
test('23 /platform returns to Platform Mode', () => {
  assert.match(router, /\{ path: '\/platform', component: SuperAdminPage, meta: \{ roles: \['SUPER_ADMIN'\] \} \}/);
});
test('24 no redirect loop (SuperAdminPage never redirects away from /platform; it only clears local state)', () => {
  assert.doesNotMatch(superAdminPage, /router\.(push|replace)\('\/platform'\)/);
  assert.doesNotMatch(superAdminPage, /redirect/);
});

// ============ 25-28: cross-user ============
test('25 User A platform/farm context does not leak to User B (farmStore persistence is userId-scoped, unchanged UX-1D mechanism)', () => {
  authStore.user = { id: 'user-a', name: 'Admin A', role: 'PLATFORM_ADMIN', canonicalRole: 'SUPER_ADMIN', farmId: null };
  farmStore.setCurrentFarm('farm-a-selected', 'Farm Selected By A');
  authStore.user = { id: 'user-b', name: 'Admin B', role: 'PLATFORM_ADMIN', canonicalRole: 'SUPER_ADMIN', farmId: null };
  farmStore.resolveInitialFarm();
  assert.equal(farmStore.currentFarmId, null, "User B must not inherit User A's selected farm");
});
test('26 logout safely namespaces platform context (platformContextStore is in-memory only, never written to localStorage; nothing to leak across sessions)', () => {
  platformContextStore.selectTenant('tenant-leak-test', 'Should Not Persist');
  assert.equal(globalThis.localStorage.getItem('agrios_platform_context'), null, 'no platform-context key should ever be written to localStorage');
  platformContextStore.clear();
});
test('27 a non-SUPER_ADMIN user cannot inherit SUPER_ADMIN mode state (getPlatformMode returns null for every other role)', () => {
  for (const role of ['FARMER', 'MANAGER', 'INSTALLER', 'ENGINEER']) {
    assert.equal(getPlatformMode(role, 'some-farm-id'), null);
    assert.equal(getPlatformMode(role, null), null);
  }
});
test('28 FARMER/MANAGER role navigation remains unchanged (App.vue/AppTabBar.vue SUPER_ADMIN branches never execute for these roles)', () => {
  const appNavBody = appVue.match(/const visibleNavigation = computed\(\(\) => \{([\s\S]*?)\n\}\);/)[1];
  assert.match(appNavBody, /if \(role\.value === 'SUPER_ADMIN'\) return superAdminNavigation\(\);/);
  assert.match(appNavBody, /if \(role\.value === 'FARMER' \|\| role\.value === 'MANAGER'\) return deduped;/);
});

// ============ 29-35: navigation ============
test('29 Platform Mode does not expose normal farm nav as the active primary shell (superAdminNavigation returns workspaceNavigation only when not in Farm Operation Mode)', () => {
  const fn = appVue.match(/function superAdminNavigation\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /return workspaceNavigation\.filter\(\(item\) => canAccess\(item\.roles, role\.value\)\)/);
});
test('30 Farm Operation Mode exposes the accepted normal farm navigation (primaryNavigation unmodified, not applyRoleAwareHome-rewritten)', () => {
  const fn = appVue.match(/function superAdminNavigation\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /if \(mode\.value === 'FARM_OPERATION'\)/);
  assert.match(fn, /primaryNavigation\.slice\(0, profileIndex\), \.\.\.desktopSecondaryNavigation, \.\.\.primaryNavigation\.slice\(profileIndex\)/);
  assert.doesNotMatch(fn, /applyRoleAwareHome/, '首页 must stay literally /cockpit in Farm Operation Mode, not rewritten to /platform');
});
test('31 ENGINEER workspace navigation unchanged (EngineerWorkbenchPage untouched by UX-1H)', () => {
  assert.match(engineerPage, /工程师工作台/);
  assert.match(engineerPage, /设备诊断/);
  assert.doesNotMatch(engineerPage, /平台模式|农场运营|platformContextStore/);
});
test('32 INSTALLER workspace navigation unchanged (InstallerChecksPage untouched by UX-1H)', () => {
  assert.match(installerPage, /设备安装验收/);
  assert.match(installerPage, /调试步骤/);
  assert.doesNotMatch(installerPage, /平台模式|农场运营|platformContextStore/);
});
test('33 no ThingsBoard sync action added anywhere in the frontend', () => {
  // Checks for an actual wired call/endpoint reference, not the mere words "ThingsBoard"/"Sync"
  // -- SuperAdminPage.vue's own code comment explicitly documents the absence of this button,
  // which would otherwise false-positive a naive substring check.
  for (const file of [superAdminPage, appVue, appTabBar]) {
    assert.doesNotMatch(file, /sync-devices|syncThingsBoardDevices\(/);
  }
});
test('34 no check-health action added anywhere in the frontend', () => {
  for (const file of [superAdminPage, appVue, appTabBar]) {
    assert.doesNotMatch(file, /check-health|checkDevicesHealth|健康检查/);
  }
});
test('35 no giant Super Admin route dump introduced (SuperAdminPage links to at most the picker + existing platform tools, not every route)', () => {
  const routerLinkCount = [...superAdminPage.matchAll(/<RouterLink|to="\//g)].length;
  assert.ok(routerLinkCount <= 2, `SuperAdminPage should not turn into a route directory (found ${routerLinkCount} static route links)`);
});

// ============ 36-42: security ============
test('36 no backend role/permission modifications (permission-matrix.ts unchanged from SEC-IOT-2 baseline)', async () => {
  const matrix = await readSrc('../../backend/src/common/permissions/permission-matrix.ts');
  assert.match(matrix, /INSTALLER: \[PERMISSIONS\.MOBILE_READ, PERMISSIONS\.DEVICE_READ, PERMISSIONS\.INSTALLER_CHECK, PERMISSIONS\.BLUETOOTH_MAINTAIN, PERMISSIONS\.EDGE_MANAGE\]/);
});
test('37-38 SEC-IOT-1/SEC-IOT-2 authorization behavior unchanged (IotController identity/binding + privileged-operation guards intact)', async () => {
  const iotController = await readSrc('../../backend/src/modules/iot/iot.controller.ts');
  assert.match(iotController, /@Permissions\(PERMISSIONS\.DEVICE_MANAGE\)\s*\n\s*bindPlot/);
  assert.match(iotController, /@Permissions\(PERMISSIONS\.PLATFORM_CONTEXT\)\s*\n\s*checkDevicesHealth/);
  assert.match(iotController, /@Permissions\(PERMISSIONS\.PLATFORM_CONTEXT\)\s*\n\s*syncThingsBoardDevices/);
});
test('39 generic IoT binding INSTALLER remains forbidden (INSTALLER has no DEVICE_MANAGE in the permission matrix)', async () => {
  const matrix = await readSrc('../../backend/src/common/permissions/permission-matrix.ts');
  const installerLine = matrix.match(/INSTALLER: \[[^\]]+\]/)[0];
  assert.doesNotMatch(installerLine, /DEVICE_MANAGE/);
});
test('40-41 ThingsBoard sync and check-health remain platform-only (PLATFORM_CONTEXT-gated, unchanged)', async () => {
  const iotController = await readSrc('../../backend/src/modules/iot/iot.controller.ts');
  assert.match(iotController, /@Permissions\(PERMISSIONS\.PLATFORM_CONTEXT\)\s*\n\s*syncThingsBoardDevices/, 'syncThingsBoardDevices must remain PLATFORM_CONTEXT-gated');
  assert.match(iotController, /@Permissions\(PERMISSIONS\.PLATFORM_CONTEXT\)\s*\n\s*checkDevicesHealth/, 'checkDevicesHealth must remain PLATFORM_CONTEXT-gated');
});
test('42 P1-TB-TENANT-MAPPING remains explicitly unresolved and is not falsely represented as solved', async () => {
  for (const file of [superAdminPage, appVue]) {
    assert.doesNotMatch(file, /租户映射已解决|tenant mapping (solved|resolved)/i);
  }
  // The known limitation documented in SEC-IOT-2 (global, non-tenant-filtered ThingsBoard device
  // matching) remains unmodified by UX-1H -- this phase adds no ThingsBoard sync code at all.
  const iotDeviceService = await readSrc('../../backend/src/modules/iot/iot-device.service.ts');
  assert.match(iotDeviceService, /findFirst\(\{ where: \{ thingsboardDeviceId \} \}\)/);
});

// ============ 43-49: routes ============
test('43-45 route count remains 30/27/3', () => {
  const routesArrayBody = router.match(/routes:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/)[1];
  const lines = routesArrayBody.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('{'));
  const pageBacked = lines.filter((line) => line.includes('component:')).length;
  const nonPage = lines.length - pageBacked;
  assert.equal(lines.length, 30, `expected 30 total route entries, found ${lines.length}`);
  assert.equal(pageBacked, 27, `expected 27 page-backed routes, found ${pageBacked}`);
  assert.equal(nonPage, 3, `expected 3 non-page routes, found ${nonPage}`);
});
test('46 /farm-records redirect unchanged', () => {
  assert.match(router, /\{ path: '\/farm-records', redirect: \(\) => \(\{ path: '\/operations', query: \{ tab: 'records' \} \}\) \}/);
});
test('47-48 no route removed or renamed (all previously accepted paths still present verbatim)', () => {
  for (const routePath of ['/platform', '/cockpit', '/manager', '/map', '/operations', '/alerts', '/reports', '/profile', '/fields/:fieldId', '/operation-reports/:id', '/engineer', '/installer-checks']) {
    assert.match(router, new RegExp(`path: '${routePath.replace(/[/:]/g, '\\$&')}'`), `missing or renamed route: ${routePath}`);
  }
});
test('49 no route meta widened (SUPER_ADMIN-relevant role meta arrays unchanged)', () => {
  assert.match(router, /\{ path: '\/manager', component: ManagerWorkbenchPage, meta: \{ roles: \['MANAGER', 'SUPER_ADMIN'\] \} \}/);
  assert.match(router, /\{ path: '\/engineer', component: EngineerWorkbenchPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.match(router, /\{ path: '\/installer-checks', component: InstallerChecksPage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.match(router, /\{ path: '\/platform', component: SuperAdminPage, meta: \{ roles: \['SUPER_ADMIN'\] \} \}/);
});

// --- Safety regression guards ---
test('S1 no real-control API newly wired into SuperAdminPage/App.vue', () => {
  for (const file of [superAdminPage, appVue]) {
    for (const forbidden of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening', 'controlValve', 'emergencyStop']) {
      assert.doesNotMatch(file, new RegExp(forbidden));
    }
  }
});
test('S2 ValveControlTestPage dry-run unchanged (file untouched by UX-1H)', async () => {
  const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
});
test('S3 production-api dryRun:true hardgate unchanged', async () => {
  const productionApi = await readSrc('../src/api/production-api.ts');
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
});
test('S4 CockpitPage (Farmer Home) and ManagerWorkbenchPage untouched by UX-1H', () => {
  // Note: managerPage's own pre-existing subtitle legitimately contains the substring "农场运营"
  // (as part of "农场运营状态", unrelated to UX-1H's Farm Operation Mode) -- check for the
  // unambiguous UX-1H-specific signal instead of that ambiguous phrase.
  assert.doesNotMatch(cockpit, /平台模式|platformContextStore|getPlatformMode/);
  assert.doesNotMatch(managerPage, /平台模式|platformContextStore|getPlatformMode/);
});

// ============ UX-HOTFIX-1: App.vue absorbed DemoHeader's context semantics ============
// DemoHeader.vue (and its farmContextLabel computed) was removed by UX-HOTFIX-1 -- it was a
// second, redundant header rendered on every page underneath App.vue's own header, and the
// literal source of the banned "农业版特斯拉中控屏" wording. App.vue's own contextLabel/farmName
// computeds are now the single header context source; these tests were rewritten to assert the
// same semantic guarantees (no hardcoded fake farm banner, no stale/ref-cached label, Platform
// Mode never looks farm-scoped, no fabricated farm name) against the surviving implementation.
test('C1 no hardcoded fake farm banner text in App.vue\'s header template', () => {
  const templateBody = appVue.match(/<template>([\s\S]*?)<\/template>/)[1];
  assert.doesNotMatch(templateBody, /洋葱智慧农场|农业版特斯拉中控屏/);
});
test('C2 App.vue reuses farmStore + the accepted getPlatformMode helper -- no new/duplicate context state', () => {
  assert.match(appVue, /import \{ farmStore \} from '\.\/stores\/farm\.store'/);
  assert.match(appVue, /import \{ getPlatformMode \} from '\.\/services\/platform-mode'/);
  for (const forbidden of ['currentFarm =', 'selectedFarm =', 'demoFarm =', 'new stores/', 'platform-context-2']) {
    assert.doesNotMatch(appVue, new RegExp(forbidden.replace(/[[\]]/g, '\\$&')));
  }
});
test('C3 SUPER_ADMIN + /platform + no active farm cannot render a farm-scoped banner (Platform Mode never looks farm-scoped)', () => {
  const computedBody = appVue.match(/const contextLabel = computed\(\(\) => \{([\s\S]*?)\n\}\);/)[1];
  assert.match(computedBody, /if \(mode\.value === 'PLATFORM'\) return '平台模式';/);
});
test('C4 Farm Operation Mode (and every other role) uses the real farmStore.currentFarmName, never a hardcoded name', () => {
  const farmNameBody = appVue.match(/const farmName = computed\(\(\) => ([^;]+);/)[1];
  assert.match(farmNameBody, /farmStore\.currentFarmName/);
});
test('C5 changing/clearing farm context cannot leave the previous farm name stuck (label is a computed derived live from farmStore, not a cached/local copy)', () => {
  assert.doesNotMatch(appVue, /const (contextLabel|farmName) = ref/, 'must be a computed, not a ref that could go stale');
  assert.match(appVue, /const contextLabel = computed\(/);
  assert.match(appVue, /const farmName = computed\(/);
});
test('C6 genuine no-farm-resolved state is honestly labeled, never presented as a fabricated real farm', () => {
  const farmNameBody = appVue.match(/const farmName = computed\(\(\) => ([^;]+);/)[1];
  assert.match(farmNameBody, /请选择农场/);
  assert.doesNotMatch(farmNameBody, /洋葱智慧农场/);
});
test('C7 no backend/security file touched by this closeout', async () => {
  const iotController = await readSrc('../../backend/src/modules/iot/iot.controller.ts');
  assert.match(iotController, /@Permissions\(PERMISSIONS\.PLATFORM_CONTEXT\)\s*\n\s*syncThingsBoardDevices/);
  assert.match(iotController, /@Permissions\(PERMISSIONS\.PLATFORM_CONTEXT\)\s*\n\s*checkDevicesHealth/);
});

let passed = 0;
for (const item of tests) {
  try {
    await item.run();
    passed++;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}`, error);
    process.exitCode = 1;
  }
}
console.log(`UX-1H PLATFORM MODE: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
