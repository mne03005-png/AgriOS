import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

const router = await readSrc('../src/router/index.ts');
const engineer = await readSrc('../src/pages/EngineerWorkbenchPage.vue');
const roleNavSource = await readSrc('../src/services/role-navigation.ts');
const appVue = await readSrc('../src/App.vue');
const appTabBar = await readSrc('../src/components/common/AppTabBar.vue');
const navigation = await readSrc('../src/config/navigation.ts');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const managerPage = await readSrc('../src/pages/ManagerWorkbenchPage.vue');

// --- 1: ENGINEER default landing remains /engineer ---
test('1 ENGINEER default landing remains /engineer', () => {
  assert.match(roleNavSource, /ENGINEER:\s*'\/engineer'/);
});

// --- 2-3: diagnostic-chain-oriented, not a flat route-name copy ---
test('2 /engineer presents a diagnostic-chain-oriented landing (stage groups, not a flat destination grid)', () => {
  for (const stage of ['身份 / 连接', '遥测', '安全 / 联锁', '指令 / 队列', '反馈 / 结果']) {
    assert.ok(engineer.includes(stage), `missing diagnostic stage: ${stage}`);
  }
  assert.match(engineer, /设备诊断/);
  assert.match(engineer, /维护工具/);
  assert.match(engineer, /辅助工具/);
});
test('3 engineer diagnostics is not just a flat copy of all route names (old single flat capability-grid removed)', () => {
  // The old page was one line: const items=[{path:'/x',label:'..',state:'PARTIAL'},...] rendered
  // as a single flat workspace-grid with no stage structure. Confirm that literal shape is gone
  // and real stage-oriented script state exists instead.
  assert.doesNotMatch(engineer, /const items=\[\{path:/);
  assert.doesNotMatch(engineer, /state:'PARTIAL'/);
  assert.doesNotMatch(engineer, /state:'BLOCKED_BY_HARDWARE'/);
  assert.match(engineer, /activeStage/);
  assert.match(engineer, /activeGroup/);
});

// --- 4-5: device diagnostic entry + identity/connectivity stage ---
test('4 device diagnostic entry exists (device-first: select a device before stage detail)', () => {
  assert.match(engineer, /selectDevice/);
  assert.match(engineer, /getReadOnlyDevices/);
  assert.match(engineer, /请先在上方选择一台设备/);
});
test("5 identity/connectivity stage is discoverable and uses real device fields", () => {
  const stageBlock = engineer.match(/身份 \/ 连接[\s\S]{0,1500}/)[0];
  assert.match(stageBlock, /deviceId/);
  assert.match(stageBlock, /连接状态/);
});

// --- 6: telemetry stage ---
test('6 telemetry stage is discoverable and reuses existing telemetry APIs', () => {
  assert.match(engineer, /getReadOnlyDeviceHistory/);
  assert.match(engineer, /getFarmTelemetrySummary/);
  assert.match(engineer, /农场遥测汇总/);
});

// --- 7: safety/interlock stage, using real data only ---
test('7 safety/interlock stage is discoverable and uses real existing valve/telemetry data (no invented safety API)', () => {
  const stageBlock = engineer.match(/安全 \/ 联锁[\s\S]{0,1500}/)[0];
  assert.match(stageBlock, /Dry-Run/);
  assert.match(stageBlock, /真实控制/);
  assert.match(stageBlock, /液位/);
  assert.doesNotMatch(engineer, /getSafetyState|getInterlockStatus|\/safety\/status/, 'must not invent a new safety API');
});
test('7b approval stage is honest, not a new workflow, and does not import approval-api.ts', () => {
  assert.match(engineer, /当前无可用审批诊断数据/);
  assert.doesNotMatch(engineer, /approval-api/, 'must not connect the currently-unused approval-api.ts');
});

// --- 8-9: command stage links to /valve-control-test, not reimplemented inline ---
test('8 command stage links to /valve-control-test', () => {
  assert.match(engineer, /to="\/valve-control-test"/);
});
test('9 valve test remains external / linked, not reimplemented inline (no dry-run command buttons on EngineerWorkbench)', () => {
  for (const forbidden of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening', 'runTestOpen', 'runClose', 'runSetOpening']) {
    assert.doesNotMatch(engineer, new RegExp(forbidden), `EngineerWorkbenchPage must not reimplement valve command logic: ${forbidden}`);
  }
});

// --- 10: queue stage honestly marked placeholder ---
test('10 queue stage is honestly marked placeholder', () => {
  assert.match(engineer, /队列诊断（完整视图）：功能建设中/);
  assert.match(engineer, /to="\/action-queue"/);
});

// --- 11: gateway/PLC stage discoverable ---
test('11 gateway/PLC stage is discoverable', () => {
  assert.match(engineer, /网关 \/ PLC 深度诊断/);
  assert.match(engineer, /to="\/edge-gateways"/);
});

// --- 12: feedback/result stage represented only where real data supports it ---
test('12 feedback/result stage uses real existing valve status data, distinguishes multiple states honestly', () => {
  assert.match(engineer, /getValveControlStatus/);
  for (const code of ['NO_COMMAND', 'FEEDBACK_PENDING', 'OUTCOME_UNKNOWN', 'FEEDBACK_MISMATCH', 'FAILED', 'CONFIRMED']) {
    assert.match(engineer, new RegExp(code), `feedback/result stage must distinguish ${code}`);
  }
  assert.doesNotMatch(engineer, /异常/, 'must not collapse feedback states into a single generic 异常 label');
});

// --- 13-20: direct routes remain ---
test('13 /devices direct route remains', () => {
  assert.match(router, /\{ path: '\/devices', component: ReadOnlyTelemetryPage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('14 /device-integration direct route remains', () => {
  assert.match(router, /\{ path: '\/device-integration', component: DeviceIntegrationPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('15 /edge-gateways direct route remains', () => {
  assert.match(router, /\{ path: '\/edge-gateways', component: EdgeGatewayPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('16 /bluetooth-maintenance direct route remains', () => {
  assert.match(router, /\{ path: '\/bluetooth-maintenance', component: BluetoothMaintenancePage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('17 /valve-control-test direct route remains', () => {
  assert.match(router, /\{ path: '\/valve-control-test', component: ValveControlTestPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('18 /action-queue direct route remains', () => {
  assert.match(router, /\{ path: '\/action-queue', component: ActionQueuePage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('19 /demo-status direct route remains', () => {
  assert.match(router, /\{ path: '\/demo-status', component: DemoStatusPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('20 /showcase direct route remains', () => {
  assert.match(router, /\{ path: '\/showcase', component: ShowcasePage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});
test('20b /engineer route itself is unchanged (path, component, role meta)', () => {
  assert.match(router, /\{ path: '\/engineer', component: EngineerWorkbenchPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});

// --- 21: engineer retains access to normal farm routes ---
test('21 Engineer retains discoverable access to already-authorized normal farm routes (no new route guard added)', () => {
  const farmContextBlock = engineer.match(/农场上下文[\s\S]{0,600}/)[0];
  for (const target of ['/cockpit', '/map', '/operations', '/alerts', '/reports']) {
    assert.match(farmContextBlock, new RegExp(`to="${target.replace('/', '\\/')}"`), `Engineer landing must link to ${target}`);
  }
  for (const target of ['/cockpit', '/map', '/operations', '/alerts', '/reports']) {
    const routeLine = router.match(new RegExp(`\\{ path: '${target.replace('/', '\\/')}'[^}]*\\}`));
    assert.ok(routeLine, `${target} must still be a registered route`);
    assert.doesNotMatch(routeLine[0], /roles:/, `${target} must not gain new role restrictions`);
  }
});

// --- 22-23: no capability widening ---
test('22 no Super Admin platform capability is exposed as Engineer capability', () => {
  for (const forbidden of ['/platform', 'x-platform-context', 'cross-tenant']) {
    assert.doesNotMatch(engineer, new RegExp(forbidden.replace(/[/-]/g, '\\$&')), `EngineerWorkbenchPage must not surface Super Admin platform capability: ${forbidden}`);
  }
});
test('23 no Installer permission widening occurs (route meta for installer-only/shared routes unchanged)', () => {
  assert.match(router, /\{ path: '\/installer-checks', component: InstallerChecksPage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.match(router, /\{ path: '\/bluetooth-maintenance', component: BluetoothMaintenancePage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
  assert.match(router, /\{ path: '\/devices', component: ReadOnlyTelemetryPage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \} \}/);
});

// --- 24: partial API failure isolation ---
test('24 partial API failure does not crash the entire Engineer landing (Promise.allSettled, independent per-stage status checks)', () => {
  assert.match(engineer, /Promise\.allSettled/);
  assert.doesNotMatch(engineer, /await Promise\.all\(/, 'must not use Promise.all, which rejects the whole batch on one failure');
  const fulfilledChecks = [...engineer.matchAll(/\.status === 'fulfilled'/g)].length;
  assert.ok(fulfilledChecks >= 4, 'each diagnostic stage API result must be checked independently before use');
});

// --- 25: raw engineering identifiers remain available ---
test('25 raw engineering identifiers remain available where useful (commandId/requestId, not hidden behind translation)', () => {
  assert.match(engineer, /commandId/);
  assert.match(engineer, /requestId/);
  assert.match(engineer, /raw/, 'should use StatusBadge raw mode to keep engineering codes untranslated');
});

// --- 26-27: normal navigation unchanged ---
test('26 Farmer normal navigation is unchanged (primaryNavigation untouched)', () => {
  assert.match(navigation, /\{ path: '\/cockpit', label: '首页', icon: '⌂' \}/);
  assert.match(navigation, /\{ path: '\/map', label: '田块', icon: '◇' \}/);
  assert.match(navigation, /\{ path: '\/operations', label: '作业', icon: '✓' \}/);
  assert.match(navigation, /\{ path: '\/alerts', label: '告警', icon: '警' \}/);
  assert.match(navigation, /\{ path: '\/profile', label: '我的', icon: '人' \}/);
});
test('27 Manager normal navigation is unchanged (ManagerWorkbenchPage untouched by UX-1F)', () => {
  assert.match(managerPage, /快速入口/);
  assert.match(managerPage, /to="\/drone-reviews"/);
  assert.match(managerPage, /to="\/boundaries\/review"/);
  assert.doesNotMatch(managerPage, /设备诊断|工程师/, 'ManagerWorkbenchPage must not gain engineer diagnostics content');
});
test('27b CockpitPage (Farmer Home) untouched by UX-1F', () => {
  assert.match(cockpit, /今日状态/);
  assert.doesNotMatch(cockpit, /设备诊断|工程师工作台/, 'CockpitPage must not gain engineer diagnostics content');
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

// --- 29: ValveControlTestPage dry-run implementation unchanged ---
test('29 ValveControlTestPage dry-run implementation unchanged', async () => {
  const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
  for (const fn of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening']) {
    assert.match(valveTest, new RegExp(fn));
  }
  assert.match(valveTest, /requestDangerousConfirmation/, 'dangerous-operation confirmation flow must remain wired');
});

// --- 30-31: production-api dryRun hardgate unchanged ---
test('30 production-api.ts still hardcodes dryRun: true', async () => {
  const productionApi = await readSrc('../src/api/production-api.ts');
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
});
test('31 no dryRun: false introduced anywhere in production-api.ts', async () => {
  const productionApi = await readSrc('../src/api/production-api.ts');
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
});

// --- 32: no real-control API newly wired into EngineerWorkbench ---
test('32 no real-control API is newly wired into EngineerWorkbench', () => {
  for (const forbidden of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening', 'controlValve', 'emergencyStop', "from '../api/control-api'"]) {
    assert.doesNotMatch(engineer, new RegExp(forbidden.replace(/[/']/g, '\\$&')), `must not wire real-control API: ${forbidden}`);
  }
  assert.match(engineer, /getValveControlStatus/, 'only the read-only status GET is expected');
});

// --- 33: no Farmer controls become active ---
test('33 no Farmer controls become active (QuickActions/ValveControlPanel regression guard)', async () => {
  const quickActions = await readSrc('../src/components/cockpit/QuickActions.vue');
  const valvePanel = await readSrc('../src/components/control/ValveControlPanel.vue');
  assert.doesNotMatch(quickActions, /@click/);
  assert.doesNotMatch(valvePanel, /@click|defineEmits/);
});

// --- 34: no PLC/Modbus/Edge real-write setting changes ---
test('34 no PLC/Modbus/Edge real-write setting changes (EdgeGatewayPage untouched, no new write call added)', async () => {
  const edgeGateway = await readSrc('../src/pages/EdgeGatewayPage.vue');
  assert.doesNotMatch(edgeGateway, /postEdge|writeCoil|writeRegister/);
  assert.doesNotMatch(engineer, /postEdge|writeCoil|writeRegister/);
});

// --- 35: no backend control file modified (frontend-only test suite cannot inspect backend git
// state directly, but can assert no backend-only file was imported/referenced) ---
test('35 no backend control file is modified (frontend code makes no reference to backend-only control modules)', () => {
  for (const forbidden of ['SafetyService', 'ActionExecutor', 'DeviceControlService', 'ModbusAdapter']) {
    assert.doesNotMatch(engineer, new RegExp(forbidden));
  }
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
console.log(`UX-1F ENGINEER WORKSPACE: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
