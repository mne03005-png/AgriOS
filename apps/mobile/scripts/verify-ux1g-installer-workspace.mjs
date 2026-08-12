import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

const router = await readSrc('../src/router/index.ts');
const installer = await readSrc('../src/pages/InstallerChecksPage.vue');
const roleNavSource = await readSrc('../src/services/role-navigation.ts');
const navigation = await readSrc('../src/config/navigation.ts');
const engineer = await readSrc('../src/pages/EngineerWorkbenchPage.vue');
const bluetooth = await readSrc('../src/pages/BluetoothMaintenancePage.vue');
const readOnlyTelemetry = await readSrc('../src/pages/ReadOnlyTelemetryPage.vue');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const managerPage = await readSrc('../src/pages/ManagerWorkbenchPage.vue');

// --- 1: INSTALLER default landing remains /installer-checks ---
test('1 INSTALLER default landing remains /installer-checks', () => {
  assert.match(roleNavSource, /INSTALLER:\s*'\/installer-checks'/);
});

// --- 2-3: commissioning-sequence-oriented, all 10 steps represented ---
test('2 Installer Workspace is commissioning-sequence-oriented (step list, not a flat capability grid)', () => {
  assert.match(installer, /steps:/);
  assert.match(installer, /activeStepKey/);
  assert.doesNotMatch(installer, /const items=\[\{path:/, 'must not regress to the UX-1F-style flat destination grid');
});
test('3 all 10 conceptual commissioning steps are represented', () => {
  for (const label of ['项目 / 农场', '田块', '添加设备', '身份 / 绑定', '电源 / 接线', '网络', '遥测', '执行器检查', '联调', '验收']) {
    assert.match(installer, new RegExp(label.replace(/[/]/g, '\\/')), `missing step: ${label}`);
  }
});

// --- 4-5: 项目/农场 and 田块 truthful status ---
test('4 项目/农场 status is truthful (reuses shared farmStore, no installer-only farm context)', () => {
  const stepDef = installer.match(/key: 'project'[\s\S]{0,300}/)[0];
  assert.match(stepDef, /status: 'AVAILABLE'/);
  assert.match(installer, /farmStore\.currentFarmName/);
  assert.doesNotMatch(installer, /installerFarmId|installerSelectedFarm|installerFarmContext/, 'must not create a competing farm-context source');
});
test('5 田块 status is truthful (links to existing /map, no new field-list API)', () => {
  const stepDef = installer.match(/key: 'field'[\s\S]{0,300}/)[0];
  assert.match(stepDef, /status: 'AVAILABLE'/);
  assert.match(installer, /to="\/map"/);
});

// --- 6: 添加设备 not falsely implemented ---
test('6 添加设备 is honestly FUTURE, no active button that does nothing', () => {
  const stepDef = installer.match(/key: 'add-device'[\s\S]{0,300}/)[0];
  assert.match(stepDef, /status: 'FUTURE'/);
  assert.doesNotMatch(installer, /<button[^>]*>添加设备/, 'must not render an active-looking add-device button');
});

// --- 7-8: 身份/绑定 authorization status explicit, no write UI exposed ---
test('7 身份/绑定 authorization status is explicit (PARTIAL, explained)', () => {
  const stepDef = installer.match(/key: 'binding'[\s\S]{0,400}/)[0];
  assert.match(stepDef, /status: 'PARTIAL'/);
  assert.match(installer, /绑定操作暂未开放/);
});
test('8 binding write UI is NOT exposed (no bind-plot/confirm-binding-candidate call, no bind button)', () => {
  for (const forbidden of ['bindPlot', 'confirmBindingCandidate', 'linkThingsBoardDevice', 'postBind', 'bind-plot', 'confirm-binding-candidate']) {
    assert.doesNotMatch(installer, new RegExp(forbidden), `must not wire a binding write action: ${forbidden}`);
  }
  assert.doesNotMatch(installer, /<button[^>]*>.*绑定.*<\/button>/, 'must not render an active bind action button');
});

// --- 9: no backend permission widening ---
test('9 no backend permission widening occurs (installer.controller.ts / iot.controller.ts untouched)', async () => {
  const installerController = await readSrc('../../backend/src/modules/installer/installer.controller.ts');
  const iotController = await readSrc('../../backend/src/modules/iot/iot.controller.ts');
  assert.match(installerController, /@Permissions\(PERMISSIONS\.INSTALLER_CHECK\)/);
  assert.doesNotMatch(iotController, /@Permissions\(/, 'IotController must remain unmodified -- no new permission decorator added');
});

// --- 10-11: 电源/接线 and 网络 use only real existing fields ---
test('10 电源/接线 uses only real existing fields (batteryOk), no invented electrical data', () => {
  const stepBlock = installer.match(/'power'[\s\S]{0,700}/)[0];
  assert.match(stepBlock, /batteryOk/);
  for (const invented of ['voltage', 'continuity', 'relay']) {
    assert.doesNotMatch(installer, new RegExp(invented, 'i'), `must not invent electrical field: ${invented}`);
  }
  assert.doesNotMatch(installer, /\bcurrent\b/i, 'must not invent an electrical "current" reading field (distinct from the JS word "currentFarmName"/"currently")');
});
test('11 网络 step uses installer-appropriate information (signalOk), not raw MQTT/PLC/Modbus terms', () => {
  const stepBlock = installer.match(/activeStepKey === 'network'[\s\S]{0,700}/)[0];
  assert.match(stepBlock, /signalOk/);
  for (const raw of ['MQTT topic', 'Modbus unit', 'PLC register']) {
    assert.doesNotMatch(installer, new RegExp(raw));
  }
});

// --- 12-14: 遥测 discoverable, /devices and /bluetooth-maintenance remain available ---
test('12 遥测 step is discoverable and links to /devices', () => {
  assert.match(installer, /activeStepKey === 'telemetry'/);
  assert.match(installer, /to="\/devices"/);
});
test('13 /devices remains available to INSTALLER', () => {
  assert.match(router, /\{ path: '\/devices', component: ReadOnlyTelemetryPage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('14 /bluetooth-maintenance remains available to INSTALLER', () => {
  assert.match(router, /\{ path: '\/bluetooth-maintenance', component: BluetoothMaintenancePage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});

// --- 15: 执行器检查 does not expose /valve-control-test ---
test('15 执行器检查 does not expose /valve-control-test', () => {
  assert.doesNotMatch(installer, /valve-control-test/);
  const stepDef = installer.match(/key: 'actuator'[\s\S]{0,400}/)[0];
  assert.match(stepDef, /status: 'FUTURE'/);
});

// --- 16: 联调 reflects actual partial capability ---
test('16 联调 reflects actual partial capability and links to /bluetooth-maintenance', () => {
  const stepDef = installer.match(/key: 'integration'[\s\S]{0,400}/)[0];
  assert.match(stepDef, /status: 'PARTIAL'/);
  assert.match(installer, /to="\/bluetooth-maintenance"/);
});

// --- 17: 验收 does not invent a submit/signoff action ---
test('17 验收 does not invent a submit/signoff action', () => {
  const stepDef = installer.match(/key: 'acceptance'[\s\S]{0,400}/)[0];
  assert.match(stepDef, /status: 'PARTIAL'/);
  assert.match(installer, /检查结果可查看，但正式验收提交功能尚未实现/);
  for (const forbidden of ['markPassed', 'markFailed', 'postAcceptance', 'submitAcceptance', 'signOff']) {
    assert.doesNotMatch(installer, new RegExp(forbidden), `must not wire a new sign-off action: ${forbidden}`);
  }
});

// --- 18-20: no route widening ---
test('18 Installer does not gain /device-integration', () => {
  assert.match(router, /\{ path: '\/device-integration', component: DeviceIntegrationPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.doesNotMatch(installer, /device-integration/);
});
test('19 Installer does not gain /edge-gateways', () => {
  assert.match(router, /\{ path: '\/edge-gateways', component: EdgeGatewayPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.doesNotMatch(installer, /edge-gateways/);
});
test('20 Installer does not gain /valve-control-test route access', () => {
  assert.match(router, /\{ path: '\/valve-control-test', component: ValveControlTestPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});

// --- 21: no Engineer raw diagnostic chain copied in ---
test('21 no Engineer raw diagnostic chain copied into Installer Workspace', () => {
  for (const engineerTerm of ['身份 / 连接', '安全 / 联锁', '反馈 / 结果', 'demoValveId', 'getValveControlStatus', 'getFarmTelemetrySummary', 'getActionQueueJobs']) {
    assert.doesNotMatch(installer, new RegExp(engineerTerm.replace(/[/]/g, '\\/')), `must not copy Engineer-only concept: ${engineerTerm}`);
  }
  assert.doesNotMatch(installer, /commandId|requestId|queueJobId/, 'must not surface raw command/queue engineering identifiers');
});

// --- 22-23: farm context coherent, device/data scope labels truthful ---
test('22 farm context remains coherent where used (shared farmStore, no page-local farm state)', () => {
  assert.match(installer, /import \{ farmStore \} from '\.\.\/stores\/farm\.store'/);
});
test('23 device/data scope labels are truthful (installer-check records vs /devices telemetry are labeled distinctly)', () => {
  assert.match(installer, /验收记录中的遥测检查字段/);
  assert.match(installer, /设备遥测：/);
});

// --- 24: future states render in Chinese, not raw NOT_IMPLEMENTED ---
test('24 future states render honest Chinese copy, not raw NOT_IMPLEMENTED', () => {
  assert.doesNotMatch(installer, /NOT_IMPLEMENTED/);
  assert.match(installer, /功能建设中/);
});

// --- 25: partial API failure does not crash the whole workspace ---
test('25 partial API failure does not crash the whole workspace (Promise.allSettled, independent status checks)', () => {
  assert.match(installer, /Promise\.allSettled/);
  assert.doesNotMatch(installer, /await Promise\.all\(/, 'must not use Promise.all, which rejects the whole batch on one failure');
  const fulfilledChecks = [...installer.matchAll(/\.status === 'fulfilled'/g)].length;
  assert.ok(fulfilledChecks >= 2, 'each independent data source must be checked independently before use');
});

// --- 26-27: mobile/desktop layout reuses existing responsive CSS, no new layout framework ---
test('26-27 layout reuses existing device-row/panel CSS patterns (mobile-usable, desktop-usable via existing breakpoints)', async () => {
  const mobileCss = await readSrc('../src/styles/mobile.css');
  assert.match(installer, /class="device-row"/);
  assert.match(mobileCss, /\.device-row \{/);
  assert.match(mobileCss, /@media \(min-width: 1200px\)/, 'existing desktop breakpoint must still exist for this page to reflow into');
});

// --- 28: route count invariant ---
test('28 route count remains 30/27/3', () => {
  const routesArrayBody = router.match(/routes:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/)[1];
  const lines = routesArrayBody.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('{'));
  const pageBacked = lines.filter((line) => line.includes('component:')).length;
  const nonPage = lines.length - pageBacked;
  assert.equal(lines.length, 30, `expected 30 total route entries, found ${lines.length}`);
  assert.equal(pageBacked, 27, `expected 27 page-backed routes, found ${pageBacked}`);
  assert.equal(nonPage, 3, `expected 3 non-page routes, found ${nonPage}`);
});

// --- Authorization verification evidence (section 32) ---
test('29 binding candidate endpoint is confirmed READ-only (GET), not a mutation', async () => {
  const iotController = await readSrc('../../backend/src/modules/iot/iot.controller.ts');
  assert.match(iotController, /@Get\('devices\/binding-candidates'\)/);
  assert.match(iotController, /@Get\('devices\/:id\/binding-candidates'\)/);
});
test('30 bind write endpoints exist but carry no role/permission guard (verified: JwtAuthGuard+TenantGuard only, no PermissionsGuard/@Permissions)', async () => {
  const iotController = await readSrc('../../backend/src/modules/iot/iot.controller.ts');
  assert.match(iotController, /@Post\('devices\/:id\/bind-plot'\)/);
  assert.match(iotController, /@Post\('devices\/:id\/confirm-binding-candidate'\)/);
  assert.doesNotMatch(iotController, /PermissionsGuard/, 'IotController must not have gained a PermissionsGuard in this phase (and had none at baseline)');
});
test('31 permission matrix confirms INSTALLER has no dedicated binding permission distinct from other roles (no role-scoped grant exists to infer authorization from)', async () => {
  const matrix = await readSrc('../../backend/src/common/permissions/permission-matrix.ts');
  assert.match(matrix, /INSTALLER: \[PERMISSIONS\.MOBILE_READ, PERMISSIONS\.DEVICE_READ, PERMISSIONS\.INSTALLER_CHECK, PERMISSIONS\.BLUETOOTH_MAINTAIN, PERMISSIONS\.EDGE_MANAGE\]/);
});

// --- Safety freeze regression ---
test('32 no real-control API is newly wired into InstallerChecksPage', () => {
  for (const forbidden of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening', 'controlValve', 'emergencyStop', 'postEdge', 'writeCoil', 'writeRegister']) {
    assert.doesNotMatch(installer, new RegExp(forbidden), `must not wire real-control API: ${forbidden}`);
  }
});
test('33 ValveControlTestPage dry-run implementation unchanged', async () => {
  const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
  for (const fn of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening']) assert.match(valveTest, new RegExp(fn));
});
test('34 production-api.ts still hardcodes dryRun: true, no dryRun: false introduced', async () => {
  const productionApi = await readSrc('../src/api/production-api.ts');
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
});
test('35 no Farmer controls become active (QuickActions/ValveControlPanel regression guard)', async () => {
  const quickActions = await readSrc('../src/components/cockpit/QuickActions.vue');
  const valvePanel = await readSrc('../src/components/control/ValveControlPanel.vue');
  assert.doesNotMatch(quickActions, /@click/);
  assert.doesNotMatch(valvePanel, /@click|defineEmits/);
});

// --- UX-1F preservation ---
test('36 Engineer Workspace unchanged by UX-1G', () => {
  assert.match(engineer, /工程师工作台/);
  assert.match(engineer, /设备诊断/);
  assert.doesNotMatch(engineer, /设备安装验收|调试步骤/, 'EngineerWorkbenchPage must not gain Installer commissioning content');
});
test('37 Farmer/Manager normal navigation unchanged', () => {
  assert.match(navigation, /\{ path: '\/cockpit', label: '首页', icon: '⌂' \}/);
  assert.doesNotMatch(cockpit, /设备安装验收|调试步骤/, 'CockpitPage must not gain Installer content');
  assert.doesNotMatch(managerPage, /设备安装验收|调试步骤/, 'ManagerWorkbenchPage must not gain Installer content');
});
test('38 BluetoothMaintenancePage and ReadOnlyTelemetryPage API behavior unchanged', () => {
  assert.match(bluetooth, /getBluetoothSessions/);
  assert.match(readOnlyTelemetry, /getReadOnlyDevices/);
  assert.doesNotMatch(bluetooth, /steps:|activeStepKey/, 'BluetoothMaintenancePage must not be restructured into a step workflow');
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
console.log(`UX-1G INSTALLER WORKSPACE: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
