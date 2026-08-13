import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

const theme = await readSrc('../src/styles/theme.css');
const mobileCss = await readSrc('../src/styles/mobile.css');
const statusBadge = await readSrc('../src/components/common/StatusBadge.vue');
const statusTranslation = await readSrc('../src/services/status-translation.ts');
const navigation = await readSrc('../src/config/navigation.ts');
const appVue = await readSrc('../src/App.vue');
const appTabBar = await readSrc('../src/components/common/AppTabBar.vue');
const platformMode = await readSrc('../src/services/platform-mode.ts');
const engineerPage = await readSrc('../src/pages/EngineerWorkbenchPage.vue');
const installerPage = await readSrc('../src/pages/InstallerChecksPage.vue');
const superAdminPage = await readSrc('../src/pages/SuperAdminPage.vue');
const router = await readSrc('../src/router/index.ts');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const managerPage = await readSrc('../src/pages/ManagerWorkbenchPage.vue');
const quickActions = await readSrc('../src/components/cockpit/QuickActions.vue');
const valvePanel = await readSrc('../src/components/control/ValveControlPanel.vue');
const valveTest = await readSrc('../src/pages/ValveControlTestPage.vue');
const productionApi = await readSrc('../src/api/production-api.ts');

// --- 1: global visual tokens exist ---
test('1 global design tokens exist in theme.css (radii, shadows, borders, status colors)', () => {
  for (const token of ['--radius-sm', '--radius-lg', '--shadow-sm', '--shadow-md', '--border', '--text-secondary', '--info', '--agri-green-dark']) {
    assert.match(theme, new RegExp(`${token}:`), `missing token: ${token}`);
  }
  // every pre-existing token keeps its exact original value -- no silent value drift
  for (const [token, value] of [['--agri-green', '#16a34a'], ['--tech-blue', '#2563eb'], ['--ok', '#22c55e'], ['--warn', '#f97316'], ['--danger', '#dc2626'], ['--muted', '#94a3b8'], ['--card', '#ffffff'], ['--page', '#f6f8fa'], ['--text', '#0f172a'], ['--radius', '8px']]) {
    assert.match(theme, new RegExp(`${token}: ${value.replace(/[#]/g, '\\#')};`), `pre-existing token value changed: ${token}`);
  }
});

// --- 2: spacing hierarchy exists ---
test('2 8px-oriented spacing scale exists (4/8/12/16/24/32)', () => {
  for (const [name, value] of [['--space-1', '4px'], ['--space-2', '8px'], ['--space-3', '12px'], ['--space-4', '16px'], ['--space-6', '24px'], ['--space-8', '32px']]) {
    assert.match(theme, new RegExp(`${name}: ${value};`));
  }
});

// --- 3: typography hierarchy exists ---
test('3 typography hierarchy exists with exactly 5 conceptual levels, not 15 variants', () => {
  const levels = ['--text-page-title', '--text-section-title', '--text-card-title', '--text-body', '--text-meta'];
  for (const level of levels) assert.match(theme, new RegExp(`${level}:`));
  const declaredSizeTokens = [...theme.matchAll(/--text-[a-z-]+:\s*\d+px;/g)];
  assert.equal(declaredSizeTokens.length, levels.length, `expected exactly ${levels.length} font-size tokens, found ${declaredSizeTokens.length}`);
});

// --- 4: primary/secondary/danger/disabled button styles remain distinct ---
test('4 primary/secondary/danger/disabled button styles remain visually distinct', () => {
  assert.match(mobileCss, /\.primary-button\s*\{[^}]*background: var\(--agri-green\)/);
  assert.match(mobileCss, /\.secondary-button,\s*\n\.map-toolbar button\s*\{[^}]*background: #e2e8f0/);
  assert.match(mobileCss, /\.danger-button\s*\{[^}]*background: var\(--danger\)/);
  assert.match(mobileCss, /button:disabled\s*\{[^}]*opacity: \.55;[^}]*cursor: not-allowed;/);
});

// --- 5: shared card styling exists ---
test('5 shared card/panel styling exists (border + low-elevation shadow, not floating boxes)', () => {
  const cardRule = mobileCss.match(/\.metric-card,\s*\n\.panel,\s*\n\.decision-card,\s*\n\.map-card,\s*\n\.card\s*\{([\s\S]*?)\}/)[1];
  assert.match(cardRule, /border: 1px solid var\(--border\)/);
  assert.match(cardRule, /box-shadow: var\(--shadow-sm\)/);
  assert.match(cardRule, /border-radius: var\(--radius\)/);
});

// --- 6: loading/empty/error states remain distinguishable ---
test('6 loading/empty/error states remain visually distinguishable (different classes/colors, not collapsed into one)', () => {
  assert.match(mobileCss, /\.empty-state\s*\{[^}]*color: var\(--text-secondary\)/, 'empty state must use the neutral secondary color');
  assert.match(mobileCss, /\.warning-text\s*\{[^}]*color: #b45309/, 'error/warning text must remain a distinct amber, not grey like empty/loading');
  assert.match(mobileCss, /\.mock-banner\s*\{[^}]*background: #fff7ed/, 'mock/demo fallback banner must remain visually distinct from a real error');
});

// --- 7: StatusBadge remains semantic ---
test('7 StatusBadge remains semantic (tone prop typed, translateStatusLabel still the default text source)', () => {
  assert.match(statusBadge, /tone\?:\s*'ok' \| 'info' \| 'warn' \| 'danger' \| 'muted'/);
  assert.match(statusBadge, /translateStatusLabel\(props\.label\)/);
  assert.match(statusBadge, /props\.raw \? props\.label/, 'raw prop must still preserve untranslated engineering codes');
});
test('7b new statusTone() helper maps existing status codes to tones without inventing new codes or changing translateStatusLabel', () => {
  assert.match(statusTranslation, /export function statusTone\(/);
  // every code statusTone knows about must already exist in the untouched label map
  const labelCodes = [...statusTranslation.matchAll(/^\s+([A-Z_]+):\s*'/gm)].map((m) => m[1]);
  const toneBlock = statusTranslation.match(/const statusTones: Record<string, [^=]+= \{([\s\S]*?)\n\};/)[1];
  const toneCodes = [...toneBlock.matchAll(/([A-Z_]+):\s*'/g)].map((m) => m[1]);
  for (const code of toneCodes) assert.ok(labelCodes.includes(code), `statusTone references a code not in the existing label map: ${code}`);
});

// --- 8-11: navigation order unchanged ---
test('8-9 FARMER/MANAGER mobile navigation order unchanged (首页/田块/作业/告警/我的)', () => {
  assert.match(navigation, /export const primaryNavigation: NavigationItem\[\] = \[\s*\n\s*\{ path: '\/cockpit', label: '首页', icon: '⌂' \},\s*\n\s*\{ path: '\/map', label: '田块', icon: '◇' \},\s*\n\s*\{ path: '\/operations', label: '作业', icon: '✓' \},\s*\n\s*\{ path: '\/alerts', label: '告警', icon: '警' \},\s*\n\s*\{ path: '\/profile', label: '我的', icon: '人' \}\s*\n\s*\];/);
});
test('10-11 FARMER/MANAGER desktop navigation order unchanged (数据 inserted before 我的, never reordered)', () => {
  assert.match(navigation, /export const desktopSecondaryNavigation: NavigationItem\[\] = \[\{ path: '\/reports', label: '数据', icon: '据' \}\];/);
  assert.match(appVue, /home\.slice\(0, profileIndex\), \.\.\.desktopSecondaryNavigation, \.\.\.home\.slice\(profileIndex\)/);
});

// --- 12: SUPER_ADMIN platform/farm mode semantics unchanged ---
test('12 SUPER_ADMIN platform/farm mode semantics unchanged (getPlatformMode logic untouched by UX-1I)', () => {
  assert.match(platformMode, /export function getPlatformMode\(role: CanonicalRole, currentFarmId: string \| null\): PlatformMode \{\s*\n\s*if \(role !== 'SUPER_ADMIN'\) return null;\s*\n\s*return currentFarmId \? 'FARM_OPERATION' : 'PLATFORM';\s*\n\}/);
});

// --- 13: Engineer diagnostic scope labels unchanged ---
test('13 Engineer diagnostic scope labels unchanged (演示阀门/农场级/selected-device distinctions intact)', () => {
  assert.match(engineerPage, /演示阀门安全测试（模拟，非当前选中设备/);
  assert.match(engineerPage, /演示阀门反馈（模拟测试，非当前选中设备/);
  assert.match(engineerPage, /农场级联锁 \/ 环境条件/);
  assert.match(engineerPage, /队列（农场级，未按设备过滤）/);
});

// --- 14: Installer FUTURE/PARTIAL/AVAILABLE semantics unchanged ---
test('14 Installer step statuses unchanged (AVAILABLE/PARTIAL/FUTURE assignments intact, text-labeled not color-only)', () => {
  for (const [key, status] of [['project', 'AVAILABLE'], ['field', 'AVAILABLE'], ['add-device', 'FUTURE'], ['binding', 'PARTIAL'], ['power', 'AVAILABLE'], ['network', 'AVAILABLE'], ['telemetry', 'AVAILABLE'], ['actuator', 'FUTURE'], ['integration', 'PARTIAL'], ['acceptance', 'PARTIAL']]) {
    assert.match(installerPage, new RegExp(`key: '${key}'[\\s\\S]{0,60}status: '${status}'`), `installer step ${key} status changed`);
  }
  assert.match(installerPage, /:label="step\.status" raw/, 'status must render as real text, not a color-only indicator');
});

// --- 15: header remains context-aware ---
// DemoHeader.vue was removed by UX-HOTFIX-1 (redundant second header, source of the banned
// Tesla wording); App.vue's own contextLabel computed now owns this logic.
test('15 App.vue header remains context-aware (Platform Mode vs Farm Operation Mode distinction preserved)', () => {
  assert.match(appVue, /import \{ getPlatformMode \} from '\.\/services\/platform-mode'/);
  assert.match(appVue, /if \(mode\.value === 'PLATFORM'\) return '平台模式';/);
});

// --- 16: no hardcoded fake current farm reintroduced ---
test('16 no hardcoded fake current farm reintroduced anywhere', () => {
  for (const file of [appVue, superAdminPage]) {
    const templateMatch = file.match(/<template>([\s\S]*?)<\/template>/);
    assert.doesNotMatch(templateMatch ? templateMatch[1] : file, /洋葱智慧农场 Demo/);
  }
});

// --- 17-20: safety freeze ---
test('17 ValveControlPanel remains disabled', () => {
  assert.doesNotMatch(valvePanel, /@click|defineEmits/);
  assert.equal([...valvePanel.matchAll(/<button[^>]*disabled[^>]*>/g)].length, 2);
});
test('18 QuickActions real controls remain unreachable', () => {
  assert.doesNotMatch(quickActions, /@click/);
  assert.equal([...quickActions.matchAll(/<button[^>]*disabled[^>]*>/g)].length, 3);
});
test('19 ValveControlTest remains dry-run', () => {
  assert.match(valveTest, /当前为安全模拟模式，不会真实打开阀门，不会启动水泵。/);
  for (const fn of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening']) assert.match(valveTest, new RegExp(fn));
});
test('20 no real-control button added; production-api dryRun:true unchanged', () => {
  assert.ok([...productionApi.matchAll(/dryRun:\s*true/g)].length >= 3);
  assert.doesNotMatch(productionApi, /dryRun:\s*false/);
  for (const file of [cockpit, managerPage, superAdminPage, appVue]) {
    for (const forbidden of ['postValveTestOpen', 'postValveClose', 'postValveSetOpening', 'controlValve(', 'emergencyStop(']) {
      assert.doesNotMatch(file, new RegExp(forbidden.replace(/[()]/g, '\\$&')));
    }
  }
});

// --- 21-22: ThingsBoard Sync / check-health UI absent ---
test('21 no ThingsBoard Sync UI added', () => {
  for (const file of [superAdminPage, appVue, appTabBar]) assert.doesNotMatch(file, /sync-devices|syncThingsBoardDevices\(/);
});
test('22 no check-health UI added', () => {
  for (const file of [superAdminPage, appVue, appTabBar]) assert.doesNotMatch(file, /check-health|checkDevicesHealth\(/);
});

// --- 23: route count remains 30/27/3 ---
test('23 route count remains 30/27/3', () => {
  const routesArrayBody = router.match(/routes:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/)[1];
  const lines = routesArrayBody.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('{'));
  const pageBacked = lines.filter((line) => line.includes('component:')).length;
  const nonPage = lines.length - pageBacked;
  assert.equal(lines.length, 30, `expected 30 total route entries, found ${lines.length}`);
  assert.equal(pageBacked, 27, `expected 27 page-backed routes, found ${pageBacked}`);
  assert.equal(nonPage, 3, `expected 3 non-page routes, found ${nonPage}`);
});

// --- Extra structural checks: CSS architecture discipline ---
test('X1 no duplicate/conflicting .segmented rule remains (was defined twice with conflicting styles before UX-1I)', () => {
  const segmentedBaseRuleCount = [...mobileCss.matchAll(/^\.segmented \{/gm)].length;
  assert.equal(segmentedBaseRuleCount, 1, `expected exactly one base .segmented rule, found ${segmentedBaseRuleCount}`);
});
test('X2 no new UI framework introduced (no Tailwind/Bootstrap/Vuetify dependency)', async () => {
  const pkg = await readSrc('../package.json');
  for (const framework of ['tailwind', 'bootstrap', 'vuetify', 'element-plus', 'ant-design']) {
    assert.doesNotMatch(pkg.toLowerCase(), new RegExp(framework));
  }
});
test('X3 no page-local <style> blocks introduced (visual system stays centralized, not scattered)', async () => {
  const { readdir } = await import('node:fs/promises');
  const pagesDir = new URL('../src/pages/', import.meta.url);
  const files = await readdir(pagesDir);
  for (const file of files.filter((f) => f.endsWith('.vue'))) {
    const content = await readSrc(`../src/pages/${file}`);
    assert.doesNotMatch(content, /<style/, `${file} must not introduce a local <style> block`);
  }
});
test('X4 focus-visible states exist for interactive elements (accessibility baseline)', () => {
  assert.match(theme, /button:focus-visible,\s*\na:focus-visible,\s*\ninput:focus-visible,\s*\nselect:focus-visible,\s*\ntextarea:focus-visible \{/);
  assert.match(theme, /outline: 2px solid var\(--tech-blue\);/);
});
test('X5 mobile bottom nav sizes columns to actual tab count, not a stale hardcoded 6 (was repeat(6,1fr) leftover from before UX-1E)', () => {
  assert.doesNotMatch(mobileCss, /grid-template-columns: repeat\(6, 1fr\)/);
  assert.match(mobileCss, /grid-auto-flow: column;\s*\n\s*grid-auto-columns: 1fr;/);
});
test('X6 status tone wiring on CockpitPage/ManagerWorkbenchPage active-operations badges reflects real status, not a hardcoded uniform tone', () => {
  assert.doesNotMatch(cockpit, /<StatusBadge :label="op\.status" tone="ok" \/>/);
  assert.doesNotMatch(managerPage, /<StatusBadge :label="op\.status" tone="ok" \/>/);
  assert.match(cockpit, /<StatusBadge :label="op\.status" :tone="statusTone\(op\.status\)" \/>/);
  assert.match(managerPage, /<StatusBadge :label="op\.status" :tone="statusTone\(op\.status\)" \/>/);
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
console.log(`UX-1I VISUAL SYSTEM: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
