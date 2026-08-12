import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// farm.store.ts imports `reactive` from the real 'vue' package (hoisted to the workspace root
// node_modules, not apps/mobile/node_modules), so the transpiled output must live somewhere
// INSIDE the repo tree for Node's bare-specifier resolution to find it -- unlike UX-1B's
// role-navigation.ts (relative imports only), a plain OS tmpdir would not resolve 'vue'.
// Cleaned up in the `finally` block below; must not remain in git status afterward.
const scratchDir = await mkdtemp(path.join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '.ux1d-scratch-'));

async function compileTo(relSourcePath, outFileName) {
  const source = await readFile(new URL(relSourcePath, import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Every module lands flat in the same scratch dir, so any relative specifier (./x, ../x,
  // ../../api/x, ...) just needs to become ./basename.mjs.
  javascript = javascript.replace(/from '(\.\.?\/[^']+)'/g, (_match, specifier) => `from './${specifier.split('/').pop()}.mjs'`);
  await writeFile(path.join(scratchDir, outFileName), javascript, 'utf8');
}

let exitCode = 0;
try {
  await compileTo('../src/api/mock-data.ts', 'mock-data.mjs');
  await compileTo('../src/api/auth-api.ts', 'auth-api.mjs');
  await compileTo('../src/stores/auth.store.ts', 'auth.store.mjs');
  await compileTo('../src/stores/farm.store.ts', 'farm.store.mjs');

  // auth.store.ts reads localStorage at module-eval time; stub a minimal one before import.
  globalThis.localStorage = (() => {
    let store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  })();

  const mockData = await import(pathToFileURL(path.join(scratchDir, 'mock-data.mjs')));
  const authStoreModule = await import(pathToFileURL(path.join(scratchDir, 'auth.store.mjs')));
  const farmStoreModule = await import(pathToFileURL(path.join(scratchDir, 'farm.store.mjs')));
  const { authStore } = authStoreModule;
  const { farmStore } = farmStoreModule;

  const tests = [];
  const test = (name, run) => tests.push({ name, run });

  function loginAs(user) {
    authStore.token = 'fake-token';
    authStore.user = user;
  }
  function logout() {
    authStore.token = null;
    authStore.user = null;
    globalThis.localStorage.clear();
  }

  // --- Farm context (section 36) ---
  test('1 current farm has one canonical source of truth (farmStore.currentFarmId)', () => {
    logout();
    loginAs({ id: 'u1', farmId: 'farm_a', farm: { id: 'farm_a', name: '洋葱智慧农场' } });
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmId, 'farm_a');
    assert.equal(farmStore.currentFarmName, '洋葱智慧农场');
  });

  test('2 valid persisted farm restores', () => {
    logout();
    loginAs({ id: 'u2', farmId: 'farm_b', farm: { id: 'farm_b', name: 'B farm' } });
    farmStore.setCurrentFarm('farm_b', 'B farm');
    // Simulate a fresh page load: re-resolve without re-setting, only from persisted + auth.
    farmStore.currentFarmId = null;
    farmStore.currentFarmName = null;
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmId, 'farm_b');
  });

  test('3 inaccessible/invalid persisted farm does not become authoritative', () => {
    logout();
    loginAs({ id: 'u3', farmId: 'farm_c', farm: { id: 'farm_c', name: 'C farm' } });
    // Poison localStorage directly with a farm that does NOT match this user's own farmId.
    globalThis.localStorage.setItem('agrios_current_farm', JSON.stringify({ farmId: 'farm_FOREIGN', userId: 'u3' }));
    farmStore.currentFarmId = null;
    farmStore.resolveInitialFarm();
    assert.notEqual(farmStore.currentFarmId, 'farm_FOREIGN', 'a persisted farm that does not match the authenticated user\'s own farmId must never become authoritative');
    assert.equal(farmStore.currentFarmId, 'farm_c', 'must fall back to the real authorized farm instead');
  });

  test('4 changing farm updates currentFarmId', () => {
    logout();
    loginAs({ id: 'u4', farmId: 'farm_d', farm: { id: 'farm_d', name: 'D farm' } });
    farmStore.resolveInitialFarm();
    farmStore.setCurrentFarm('farm_e', 'E farm');
    assert.equal(farmStore.currentFarmId, 'farm_e');
    assert.equal(farmStore.currentFarmName, 'E farm');
  });

  test('5 changing farm persists safely (namespaced by user)', () => {
    logout();
    loginAs({ id: 'u5', farmId: 'farm_f', farm: { id: 'farm_f', name: 'F farm' } });
    farmStore.setCurrentFarm('farm_g', 'G farm');
    const raw = JSON.parse(globalThis.localStorage.getItem('agrios_current_farm'));
    assert.equal(raw.farmId, 'farm_g');
    assert.equal(raw.userId, 'u5');
  });

  test('6 logout/user change cannot leak prior user\'s farm context', () => {
    logout();
    loginAs({ id: 'userA', farmId: 'farm_A', farm: { id: 'farm_A', name: 'Farm A' } });
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmId, 'farm_A');
    // User A logs out.
    authStore.user = null;
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmId, null, 'logout must clear farm context');
    // User B logs in -- must not inherit farm_A merely because it was cached; must resolve to
    // their OWN farm from their own auth data.
    authStore.user = { id: 'userB', farmId: 'farm_B', farm: { id: 'farm_B', name: 'Farm B' } };
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmId, 'farm_B');
    assert.notEqual(farmStore.currentFarmId, 'farm_A');
  });

  test('7 unknown/unresolvable role or missing farmId fails safely (no farm, not a guess)', () => {
    logout();
    loginAs({ id: 'u7', farmId: null, farm: null });
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmId, null);
  });

  test('8 currentFarmIdOrDefault falls back to the mock/demo default only when unresolved', () => {
    logout();
    assert.equal(farmStore.currentFarmId, null);
    assert.equal(farmStore.currentFarmIdOrDefault, mockData.defaultFarmId);
    loginAs({ id: 'u8', farmId: 'farm_h', farm: { id: 'farm_h', name: 'H farm' } });
    farmStore.resolveInitialFarm();
    assert.equal(farmStore.currentFarmIdOrDefault, 'farm_h');
  });

  let passed = 0;
  for (const item of tests) {
    try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.name}`, error); exitCode = 1; }
  }
  console.log(`UX-1D FARM STORE LOGIC: ${passed}/${tests.length} PASS`);
  if (passed !== tests.length) exitCode = 1;
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}

// --- Source-text structural checks (mirrors UX-1B/1C pattern: verify the real .vue/.ts source
// actually implements what the logic tests above assume, and verify deep-link/route
// preservation without needing a full router/DOM harness) ---
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');
const structTests = [];
const stest = (name, run) => structTests.push({ name, run });

const router = await readSrc('../src/router/index.ts');
const fieldDetail = await readSrc('../src/pages/FieldDetailPage.vue');
const mapPage = await readSrc('../src/pages/MapPage.vue');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const manager = await readSrc('../src/pages/ManagerWorkbenchPage.vue');
const appVue = await readSrc('../src/App.vue');
const valvePanel = await readSrc('../src/components/control/ValveControlPanel.vue');
const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
const productionApi = await readSrc('../src/api/production-api.ts');

// --- Deep links (section 37) ---
stest('9 /fields/:fieldId remains registered', () => {
  assert.match(router, /\{ path: '\/fields\/:fieldId', component: FieldDetailPage, props: true \}/);
});
stest('10 opening field deep link does not require a stored farm (fieldId is self-sufficient)', () => {
  assert.match(fieldDetail, /getFieldDetail\(fieldId\)/);
  assert.doesNotMatch(fieldDetail, /route\.query\.farmId/, 'must not require a farmId query parameter to resolve the field');
});
stest('11-12 field farm ownership drives context correction (not the reverse)', () => {
  assert.match(fieldDetail, /realFieldFarmId !== farmStore\.currentFarmId/);
  assert.match(fieldDetail, /farmStore\.setCurrentFarm\(realFieldFarmId/);
});
stest('16 a valid field is never rejected merely because localStorage points elsewhere', () => {
  // The load path never gates on farmStore.currentFarmId before calling getFieldDetail --
  // it is fetched unconditionally by fieldId alone.
  const loadFieldBody = fieldDetail.slice(fieldDetail.indexOf('async function loadField'), fieldDetail.indexOf('async function onValve'));
  assert.doesNotMatch(loadFieldBody, /if \(farmStore\.currentFarmId/);
});
stest('17-18 farm switch clears incompatible field and redirects to the documented compatibility destination (/map)', () => {
  assert.match(fieldDetail, /newFarmId !== fieldFarmId\.value/);
  assert.match(fieldDetail, /router\.replace\('\/map'\)/);
  // /map must actually still be a registered route (the chosen destination is valid).
  assert.match(router, /\{ path: '\/map', component: MapPage \}/);
});
stest('19 /operation-reports/:id remains unaffected', () => {
  assert.match(router, /\{ path: '\/operation-reports\/:id', component: OperationReportDetailPage, props: true \}/);
});
stest('route count/paths unchanged: /cockpit, /manager, /profile, /ai, /alerts, /reports, /operations still registered', () => {
  for (const p of ['/cockpit', '/manager', '/profile', '/ai', '/alerts', '/reports', '/operations']) {
    assert.match(router, new RegExp(`path: '${p.replace('/', '\\/')}'`));
  }
});

// --- Field Detail (section 38) ---
stest('20 Field Detail exposes a clear default overview (概况 tab, active by default)', () => {
  assert.match(fieldDetail, /const activeTab = ref<TabKey>\('概况'\)/);
  assert.match(fieldDetail, /活tab === '概况'|activeTab === '概况'/);
});
stest('21 normal Field Detail does not expose raw engineer terminology as primary content', () => {
  // Strip HTML comments (design-intent notes referencing forbidden terms by name, e.g.
  // "no MQTT/PLC internals here", are fine) so only actually-rendered text is checked.
  const staticTemplate = fieldDetail.slice(0, fieldDetail.indexOf('<script')).replace(/<!--[\s\S]*?-->/g, '');
  for (const forbidden of ['MQTT', 'PLC', 'Modbus', 'ActionPlan', 'ActionQueue', 'requestId', 'commandId']) {
    assert.doesNotMatch(staticTemplate, new RegExp(forbidden), `Field Detail template must not surface "${forbidden}"`);
  }
});
stest('22 tabs are backed by real existing FieldDetail/alerts data fields, not invented ones', () => {
  // Template expressions read refs unwrapped (`detail.x`); the <script> block reads them via
  // `detail.value.x` -- check for the field name alone so both forms match.
  for (const realField of ['cropType', 'latestMoisture', 'cropIrrigationRecipe', 'valveStatus', 'sensorStatus', 'cropHealthObservations', 'latestOperationReports', 'droneOperationRecords', 'fieldAlerts']) {
    assert.match(fieldDetail, new RegExp(realField));
  }
});
stest('23 absent data shows an honest empty state, not fabricated values', () => {
  assert.match(fieldDetail, /暂无该田块的告警/);
  assert.match(fieldDetail, /暂无灌溉记录/);
  assert.match(fieldDetail, /暂无报告/);
  assert.match(fieldDetail, /暂无无人机作业记录/);
  // Moisture trend and qualitative label are conditionally rendered, never invented when absent.
  assert.match(fieldDetail, /v-if="detail\.moistureTrend\?\.length"/);
  assert.match(fieldDetail, /moistureQualitative/);
});
stest('24-25 irrigation control remains unavailable, ValveControlPanel remains unconnected', () => {
  assert.doesNotMatch(valvePanel, /@click|defineEmits/);
  assert.equal([...valvePanel.matchAll(/<button[^>]*disabled[^>]*>/g)].length, 2);
  assert.match(fieldDetail, /<ValveControlPanel @command="onValve" \/>/);
});
stest('26 field links preserve fieldId', () => {
  assert.match(fieldDetail, /getFieldDetail\(fieldId\)/);
});
stest('27 field context survives local tab changes (activeTab is independent local UI state)', () => {
  assert.match(fieldDetail, /const activeTab = ref<TabKey>/);
  assert.doesNotMatch(fieldDetail, /watch\(\s*activeTab/, 'switching tabs must not trigger a refetch/reset of field data');
});
stest('28 current farm remains synchronized while moving through Field Detail (no separate per-tab farm state)', () => {
  assert.doesNotMatch(fieldDetail, /selectedFarm|activeFarm|farmContext|currentFarm\s*=\s*ref/i, 'must not introduce a second farm-context variable');
});

// --- Safety (sections 32/41) ---
stest('S1 QuickActions unreachable (regression guard)', async () => {
  const quickActions = await readSrc('../src/components/cockpit/QuickActions.vue');
  assert.doesNotMatch(quickActions, /@click/);
});
stest('S2 ValveControlTest dry-run unchanged (file untouched by UX-1D)', () => {
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
});
stest('S3 production-api dryRun:true hardgate unchanged', () => {
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
});

// --- UX-1C Home / UX-1B navigation preservation touchpoints ---
stest('Farmer Home uses shared current farm (farmStore), not a hardcoded default', () => {
  assert.match(cockpit, /farmStore\.currentFarmIdOrDefault/);
  assert.doesNotMatch(cockpit, /getCockpit\(defaultFarmId\)/);
});
stest('Manager Home uses the same shared current farm as Farmer Home', () => {
  assert.match(manager, /farmStore\.currentFarmIdOrDefault/);
  assert.doesNotMatch(manager, /getCockpit\(defaultFarmId\)/);
});
stest('Map respects current farm context', () => {
  assert.match(mapPage, /farmStore\.currentFarmIdOrDefault/);
});
stest('Async race guard present on Farmer Home, Manager Home, and Map (stale response cannot overwrite newer farm)', () => {
  for (const [name, src] of [['CockpitPage', cockpit], ['ManagerWorkbenchPage', manager], ['MapPage', mapPage]]) {
    assert.match(src, /requestedFarmId !== farmStore\.currentFarmIdOrDefault/, `${name} must guard against a stale in-flight request overwriting a newer farm`);
  }
});
stest('App.vue wires farm resolution once, off authStore.user identity changes', () => {
  assert.match(appVue, /watch\(\(\) => authStore\.user, \(\) => farmStore\.resolveInitialFarm\(\), \{ immediate: true \}\)/);
});
stest('Role landings (UX-1B) unchanged: role-navigation.ts untouched', async () => {
  const roleNav = await readSrc('../src/services/role-navigation.ts');
  assert.match(roleNav, /FARMER: '\/cockpit'/);
  assert.match(roleNav, /MANAGER: '\/manager'/);
  assert.match(roleNav, /INSTALLER: '\/installer-checks'/);
  assert.match(roleNav, /ENGINEER: '\/engineer'/);
  assert.match(roleNav, /SUPER_ADMIN: '\/platform'/);
});

let structPassed = 0;
for (const item of structTests) {
  try { await item.run(); structPassed++; console.log(`PASS ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.name}`, error); exitCode = 1; }
}
console.log(`UX-1D STRUCTURAL/DEEP-LINK/FIELD-DETAIL/SAFETY: ${structPassed}/${structTests.length} PASS`);
if (structPassed !== structTests.length) exitCode = 1;

process.exitCode = exitCode;
