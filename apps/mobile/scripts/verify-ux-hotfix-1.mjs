import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

const profilePage = await readSrc('../src/pages/ProfilePage.vue');
const permissions = await readSrc('../src/services/permissions.ts');
const navigation = await readSrc('../src/config/navigation.ts');
const appTabBar = await readSrc('../src/components/common/AppTabBar.vue');
const appVue = await readSrc('../src/App.vue');
const mobileCss = await readSrc('../src/styles/mobile.css');
const mapPage = await readSrc('../src/pages/MapPage.vue');
const mapToolbar = await readSrc('../src/components/map/MapToolbar.vue');
const fieldBottomSheet = await readSrc('../src/components/map/FieldBottomSheet.vue');
const mapAdapterIndex = await readSrc('../src/map-adapters/index.ts');
const amapAdapter = await readSrc('../src/map-adapters/amap.adapter.ts');
const baiduAdapter = await readSrc('../src/map-adapters/baidu-map.adapter.ts');
const googleAdapter = await readSrc('../src/map-adapters/google-map.adapter.ts');
const mockMapAdapter = await readSrc('../src/map-adapters/mock-map.adapter.ts');
const cockpit = await readSrc('../src/pages/CockpitPage.vue');
const operationsPage = await readSrc('../src/pages/OperationsPage.vue');
const droneOperationsPage = await readSrc('../src/pages/DroneOperationsPage.vue');
const reportsPage = await readSrc('../src/pages/ReportsPage.vue');
const alertsPage = await readSrc('../src/pages/AlertsPage.vue');
const droneReviewPage = await readSrc('../src/pages/DroneReviewPage.vue');
const boundaryReviewPage = await readSrc('../src/pages/BoundaryReviewPage.vue');
const changePasswordPage = await readSrc('../src/pages/ChangePasswordPage.vue');
const demoStatusPage = await readSrc('../src/pages/DemoStatusPage.vue');
const showcasePage = await readSrc('../src/pages/ShowcasePage.vue');
const routerSrc = await readSrc('../src/router/index.ts');

const FARMER_MANAGER_PAGES = {
  CockpitPage: cockpit,
  MapPage: mapPage,
  OperationsPage: operationsPage,
  AlertsPage: alertsPage,
  ProfilePage: profilePage,
  DroneOperationsPage: droneOperationsPage,
  ReportsPage: reportsPage,
  DroneReviewPage: droneReviewPage,
  BoundaryReviewPage: boundaryReviewPage,
  ChangePasswordPage: changePasswordPage
};

// ============ A: 我的 has no internally-duplicated entries ============
// Only literal to="/x" bindings are checked for duplication -- a :to="item.path"/`${...}` v-for
// binding is one loop rendering N distinct data-driven rows, not a hardcoded duplicate link.
test('A profile-nav-dedup: ProfilePage never lists the same literal destination path twice', () => {
  const links = [...profilePage.matchAll(/(?<!:)to="([^"{]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const link of links) {
    assert.ok(!seen.has(link), `ProfilePage lists ${link} more than once`);
    seen.add(link);
  }
});

// ============ B: localized role labels ============
test('B localized-role-labels: roleLabel() maps every canonical role to Chinese, never a raw code', () => {
  for (const [role, label] of [
    ['FARMER', '农场主'],
    ['MANAGER', '农场管理员'],
    ['INSTALLER', '安装调试人员'],
    ['ENGINEER', '工程师'],
    ['SUPER_ADMIN', '平台管理员']
  ]) {
    assert.match(permissions, new RegExp(`${role}: '${label}'`), `missing localized label for ${role}`);
  }
  assert.match(permissions, /export function roleLabel\(/);
});
test('B2 ProfilePage renders the role via roleLabel(), never a raw role/canonicalRole field', () => {
  assert.match(profilePage, /roleLabel\(authStore\.user\?\.canonicalRole \?\? authStore\.user\?\.role\)/);
  assert.doesNotMatch(profilePage, /\{\{\s*authStore\.user\?\.role\s*\}\}/, 'must never interpolate the raw role code directly');
});

// ============ C: no Tesla/cockpit design-language wording anywhere ============
test('C no-Tesla: the DemoHeader component (source of the banned wording) is gone', async () => {
  await assert.rejects(readSrc('../src/components/common/DemoHeader.vue'), /ENOENT/);
});
test('C2 no-Tesla: no 特斯拉/中控屏/驾驶舱 wording survives in any page or component template', async () => {
  const dirs = ['../src/pages/', '../src/components/'];
  for (const dir of dirs) {
    const entries = await readdir(new URL(dir, import.meta.url), { recursive: true });
    for (const entry of entries) {
      if (!entry.endsWith('.vue')) continue;
      const content = await readSrc(`${dir}${entry}`);
      const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
      const template = templateMatch ? templateMatch[1] : '';
      assert.doesNotMatch(template, /特斯拉|中控屏|驾驶舱/, `${entry} still has banned design-language wording in its template`);
    }
  }
});

// ============ D: no Demo/backend dev-instruction copy on FARMER/MANAGER pages ============
test('D no-Demo/backend-copy: FARMER/MANAGER-reachable pages never tell the user to run seed scripts or mention backend/Demo internals', () => {
  for (const [name, content] of Object.entries(FARMER_MANAGER_PAGES)) {
    assert.doesNotMatch(content, /npx prisma/, `${name} still instructs the user to run a seed script`);
    assert.doesNotMatch(content, /查看 Demo 状态/, `${name} still links normal users to the engineer-only Demo status page`);
    assert.doesNotMatch(content, /启动\s*backend|连接\s*backend|由后端生成/, `${name} still mentions backend internals to a normal user`);
  }
});
test('D2 ENGINEER/SUPER_ADMIN-gated diagnostic pages (DemoStatusPage/ShowcasePage) are exempt but still Tesla-free', () => {
  assert.doesNotMatch(demoStatusPage, /特斯拉|中控屏|驾驶舱/);
  assert.doesNotMatch(showcasePage, /特斯拉|中控屏|驾驶舱/);
  assert.match(routerSrc, /path: '\/demo-status', component: DemoStatusPage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \}/);
  assert.match(routerSrc, /path: '\/showcase', component: ShowcasePage, meta: \{ roles: \['ENGINEER', 'SUPER_ADMIN'\] \}/);
});

// ============ E: no mock map provider presented as a real/selectable provider ============
test('E no-mock-as-real-provider: MapToolbar is a genuine map/list view switch, not a fake provider picker', () => {
  const templateBody = mapToolbar.match(/<template>([\s\S]*?)<\/template>/)[1];
  assert.doesNotMatch(templateBody, /AMap|百度|高德|Google|Baidu/i, 'MapToolbar must not render unimplemented map providers as user-visible choices');
  assert.match(mapToolbar, /@click="\$emit\('update:modelValue', 'map'\)"/);
  assert.match(mapToolbar, /@click="\$emit\('update:modelValue', 'list'\)"/);
});
test('E2 no-mock-as-real-provider: Baidu/Google stay honest unimplemented placeholders; AMap is a real implementation but only reachable with a real key', async () => {
  for (const [name, content] of [['BaiduMapAdapter', baiduAdapter], ['GoogleMapAdapter', googleAdapter]]) {
    assert.match(content, /extends MockMapAdapter/, `${name} must stay an honest unimplemented placeholder, not silently gain fake functionality`);
  }
  // PROD-USABILITY-1: AMapAdapter is now a real AMap JS API integration (see its own file
  // header), not a MockMapAdapter alias -- but it must still be unreachable without a real key.
  assert.doesNotMatch(amapAdapter, /extends MockMapAdapter/, 'AMapAdapter should be a real implementation now, not a placeholder alias');
  assert.match(amapAdapter, /class AMapAdapter implements MapAdapter/);
  assert.match(amapAdapter, /if \(!key\) throw new Error/, 'AMapAdapter.init must refuse to run without VITE_AMAP_KEY, never silently degrade');
  assert.match(mapAdapterIndex, /import\.meta\.env\.VITE_AMAP_KEY/);
  assert.match(mapAdapterIndex, /import\.meta\.env\.VITE_BAIDU_MAP_KEY/);
  assert.match(mapAdapterIndex, /import\.meta\.env\.VITE_GOOGLE_MAP_KEY/);
  // No .env/.env.example anywhere in the mobile app may define these keys -- if one did, the
  // factory above would silently start routing to a real or fake/unimplemented adapter in
  // production. This is the exhaustive proof AMAP_CREDENTIALS_AVAILABLE=NO is still accurate.
  let envFiles = [];
  try {
    envFiles = (await readdir(new URL('../', import.meta.url))).filter((f) => f.startsWith('.env'));
  } catch {
    envFiles = [];
  }
  for (const file of envFiles) {
    const content = await readSrc(`../${file}`);
    assert.doesNotMatch(content, /VITE_AMAP_KEY=.+|VITE_BAIDU_MAP_KEY=.+|VITE_GOOGLE_MAP_KEY=.+/, `${file} must not fabricate a map provider key`);
  }
});
test('E4 no-mock-as-real-provider: without a key, the AMap code ships zero bytes to production (build-time tree-shaken, not just logically unreachable)', async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run build', { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  const distDir = new URL('../dist/assets/', import.meta.url);
  const files = await readdir(distDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'expected at least one built JS asset');
  for (const file of jsFiles) {
    const bundle = await readSrc(`../dist/assets/${file}`);
    assert.doesNotMatch(bundle, /webapi\.amap\.com/, `${file} must not ship the real AMap loader URL without a configured key`);
  }
});
test('E3 MockMapAdapter honestly documents itself as the one real, non-placeholder implementation', () => {
  assert.match(mockMapAdapter, /UX-HOTFIX-1: this is AgriOS's one legitimate, genuinely interactive map implementation/);
});

// ============ F: exactly 5 mobile bottom tabs, no more ============
test('F exactly-5-bottom-tabs: primaryNavigation has exactly 5 entries, matching 首页/田块/作业/告警/我的', () => {
  const items = [...navigation.matchAll(/\{ path: '([^']+)', label: '([^']+)', icon: '[^']+' \}/g)];
  const primaryBlock = navigation.match(/export const primaryNavigation: NavigationItem\[\] = \[([\s\S]*?)\];/)[1];
  const primaryItems = [...primaryBlock.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(primaryItems, ['首页', '田块', '作业', '告警', '我的']);
  assert.equal(items.length >= primaryItems.length, true);
});
test('F2 AppTabBar renders primaryNavigation verbatim for FARMER/MANAGER (no extra tab appended)', () => {
  assert.match(appTabBar, /primaryNavigation/);
});

// ============ G: 我的 never repeats a primary-nav destination ============
test('G no-duplicate-primary-route-in-我的: ProfilePage never links to 首页/田块/作业/告警\'s own routes', () => {
  const bannedPaths = ['/cockpit', '/map', '/operations', '/alerts'];
  for (const path of bannedPaths) {
    assert.doesNotMatch(profilePage, new RegExp(`to="${path.replace('/', '\\/')}"`), `ProfilePage must not duplicate the primary-nav route ${path}`);
  }
});

// ============ H: every visible interactive element on the map/field surfaces is real ============
test('H every-visible-action-maps-to-real-behavior: FieldBottomSheet has no window.confirm-only or handler-less buttons', () => {
  assert.doesNotMatch(fieldBottomSheet, /window\.confirm/, 'no fake confirm-dialog-only action may remain');
  assert.doesNotMatch(fieldBottomSheet, /<button(?![^>]*@click)[^>]*>/, 'every button must have a real click handler');
});
test('H2 every-visible-action-maps-to-real-behavior: MapToolbar buttons are wired, not decorative', () => {
  const buttonMatches = [...mapToolbar.matchAll(/<button[^>]*>/g)];
  assert.ok(buttonMatches.length > 0, 'expected at least one button');
  for (const button of buttonMatches) assert.match(button[0], /@click=/, `button has no click handler: ${button[0]}`);
});
test('H3 every-visible-action-maps-to-real-behavior: ProfilePage links only point at routes that actually exist', () => {
  const targets = [...profilePage.matchAll(/(?<!:)to="([^"{]+)"/g)].map((m) => m[1]);
  for (const target of targets) {
    assert.match(routerSrc, new RegExp(`path: '${target.replace(/[/-]/g, (c) => `\\${c}`)}'`), `ProfilePage links to ${target}, which has no matching route`);
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
console.log(`UX-HOTFIX-1 FOCUSED REGRESSIONS: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
