import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// role-navigation.ts has a real relative import (./permissions), which the single-file
// data-URL transpile trick (used for api-error.ts in UX-1A, which has no local imports)
// cannot resolve. Transpile the small, interrelated module set into a flat temp directory
// instead, so Node's normal relative-import resolution works, then clean up afterward.
const scratchDir = await mkdtemp(path.join(tmpdir(), 'agrios-ux1b-test-'));

async function compileTo(relSourcePath, outFileName) {
  const source = await readFile(new URL(relSourcePath, import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Node's ESM resolver needs explicit extensions; ts.transpileModule doesn't rewrite
  // specifiers, so add .mjs to same-directory relative imports within this flat scratch dir.
  javascript = javascript.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
  await writeFile(path.join(scratchDir, outFileName), javascript, 'utf8');
}

await compileTo('../src/services/permissions.ts', 'permissions.mjs');
await compileTo('../src/services/role-navigation.ts', 'role-navigation.mjs');
await compileTo('../src/config/navigation.ts', 'navigation.mjs');

const permissions = await import(pathToFileURL(path.join(scratchDir, 'permissions.mjs')));
const roleNav = await import(pathToFileURL(path.join(scratchDir, 'role-navigation.mjs')));
const navigation = await import(pathToFileURL(path.join(scratchDir, 'navigation.mjs')));

const tests = [];
const test = (name, run) => tests.push({ name, run });

// --- canonicalRole() idempotency (regression guard for a real bug found while building
// this test: App.vue's existing visibleNavigation filter pre-resolves a canonical role via
// canonicalRole(), then passes that canonical string into canAccess(), which internally
// calls canonicalRole() again. Before this fix, MANAGER/ENGINEER/SUPER_ADMIN were not
// identity-mapped in legacyMap, so the second call silently collapsed them back to FARMER,
// making canAccess() incorrectly deny workspace nav items to those exact three roles.) ---
test('0 canonicalRole is idempotent for every canonical role (canAccess is safe to double-wrap)', () => {
  for (const role of ['FARMER', 'MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN']) {
    assert.equal(permissions.canonicalRole(role), role, `canonicalRole('${role}') must return '${role}' unchanged`);
    assert.equal(permissions.canonicalRole(permissions.canonicalRole(role)), role);
  }
});

// --- Role landing (section 21) ---
test('1 FARMER default landing is /cockpit', () => assert.equal(roleNav.getDefaultRouteForRole('FARMER'), '/cockpit'));
test('2 MANAGER default landing is /manager', () => assert.equal(roleNav.getDefaultRouteForRole('FARM_MANAGER'), '/manager'));
test('3 INSTALLER default landing is /installer-checks', () => assert.equal(roleNav.getDefaultRouteForRole('INSTALLER'), '/installer-checks'));
test('4 ENGINEER default landing is /engineer', () => assert.equal(roleNav.getDefaultRouteForRole('MAINTAINER'), '/engineer'));
test('5 SUPER_ADMIN default landing is /platform', () => assert.equal(roleNav.getDefaultRouteForRole('PLATFORM_ADMIN'), '/platform'));
test('6 unknown/unrecognized role fails safely (FARMER default), never silently to /platform', () => {
  assert.equal(roleNav.getDefaultRouteForRole('SOME_UNKNOWN_ROLE'), '/cockpit');
  assert.equal(roleNav.getDefaultRouteForRole(undefined), '/cockpit');
  assert.notEqual(roleNav.getDefaultRouteForRole('SOME_UNKNOWN_ROLE'), '/platform');
});

// --- Explicit destination priority over role landing (sections 6, 7, 22) ---
test('7 explicit safe internal redirect overrides role default', () => {
  assert.equal(roleNav.resolveLandingRoute('FARMER', '/fields/field_001'), '/fields/field_001');
  assert.equal(roleNav.resolveLandingRoute('SUPER_ADMIN', '/cockpit'), '/cockpit');
  assert.equal(roleNav.resolveLandingRoute('MANAGER', '/reports'), '/reports');
  assert.equal(roleNav.resolveLandingRoute('INSTALLER', '/devices'), '/devices');
});
test('8 missing/absent explicit redirect falls back to role default', () => {
  assert.equal(roleNav.resolveLandingRoute('MANAGER', undefined), '/manager');
  assert.equal(roleNav.resolveLandingRoute('MANAGER', ''), '/manager');
  assert.equal(roleNav.resolveLandingRoute('MANAGER', null), '/manager');
  assert.equal(roleNav.resolveLandingRoute('MANAGER', ['array-not-a-string']), '/manager');
});
test('9 open-redirect targets are rejected, fall back to role default (no open-redirect behavior)', () => {
  assert.equal(roleNav.resolveLandingRoute('FARMER', '//evil.com'), '/cockpit');
  assert.equal(roleNav.resolveLandingRoute('FARMER', 'https://evil.com'), '/cockpit');
  assert.equal(roleNav.resolveLandingRoute('FARMER', 'javascript:alert(1)'), '/cockpit');
});

// --- router.ts wiring: session-restoration landing without touching the auth guard ---
test('10 root and catch-all redirects are role-aware via the centralized helper', async () => {
  const source = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8');
  assert.match(source, /path:\s*'\/',\s*redirect:\s*\(\)\s*=>\s*getDefaultRouteForRole/);
  assert.match(source, /path:\s*'\/:pathMatch\(\.\*\)\*',\s*redirect:\s*\(\)\s*=>\s*getDefaultRouteForRole/);
});
test('11 beforeEach auth guard is unchanged: role landing must never intercept direct navigation', async () => {
  const source = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8');
  const guardBlock = source.slice(source.indexOf('router.beforeEach'));
  assert.match(guardBlock, /if \(to\.meta\.public\) return true;/);
  assert.match(guardBlock, /if \(!hasStoredToken\(\)\) return \{ path: '\/login', query: \{ redirect: to\.fullPath \} \};/);
  assert.match(guardBlock, /if \(!canAccess\(roles, authStore\.user\?\.canonicalRole \?\? authStore\.user\?\.role\)\) return \{ path: '\/forbidden' \};/);
  assert.doesNotMatch(guardBlock, /getDefaultRouteForRole/, 'role-landing logic must live only in redirect targets and LoginPage, never in the permission guard');
});
test('12 /profile route is unchanged and untouched by role-landing redirects', async () => {
  const source = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8');
  assert.match(source, /\{ path: '\/profile', component: ProfilePage \}/);
});
test('13 explicit deep-link example routes remain permitted for their designated roles (guard untouched)', async () => {
  const source = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8');
  assert.match(source, /\{ path: '\/fields\/:fieldId', component: FieldDetailPage, props: true \}/, '/fields/:fieldId must have no role meta -- open to any authenticated role including ENGINEER');
  assert.match(source, /\{ path: '\/reports', component: ReportsPage \}/, '/reports must have no role meta -- open to MANAGER');
  assert.match(source, /path: '\/devices', component: ReadOnlyTelemetryPage, meta: \{ roles: \['INSTALLER', 'ENGINEER', 'SUPER_ADMIN'\] \}/, '/devices must still permit INSTALLER');
  assert.match(source, /\{ path: '\/cockpit', component: CockpitPage \}/, '/cockpit must have no role meta -- open to SUPER_ADMIN too');
});

// --- Mobile role-aware navigation (section 23) ---
function mobileTabsFor(rawRole) {
  const role = permissions.canonicalRole(rawRole);
  if (role === 'FARMER' || role === 'MANAGER') return navigation.primaryNavigation;
  return navigation.workspaceNavigation.filter((item) => permissions.canAccess(item.roles, role));
}
test('14 FARMER mobile tabs: normal farm-operation shell', () => {
  // UX-1E consolidated navigation: 农事(/farm-records) was replaced by 告警(/alerts) as a
  // primary tab; farm-records discovery moved into Operations' 农事记录 tab instead (see
  // verify-ux1e-domain-navigation.mjs for full coverage of the new shell and the redirect).
  assert.deepEqual(mobileTabsFor('FARMER').map((t) => t.path), ['/cockpit', '/map', '/operations', '/alerts', '/profile']);
});
test('15 MANAGER mobile tabs: same normal farm-operation shell as FARMER', () => {
  assert.deepEqual(mobileTabsFor('FARM_MANAGER').map((t) => t.path), mobileTabsFor('FARMER').map((t) => t.path));
});
test('16 INSTALLER mobile tabs: installer workspace only, no unauthorized widening', () => {
  assert.deepEqual(mobileTabsFor('INSTALLER').map((t) => t.path), ['/installer-checks']);
});
test('17 ENGINEER mobile tabs: engineer workspace shell', () => {
  assert.deepEqual(mobileTabsFor('MAINTAINER').map((t) => t.path).sort(), ['/engineer', '/installer-checks'].sort());
});
test('18 SUPER_ADMIN mobile tabs: full platform workspace shell, includes /platform', () => {
  const paths = mobileTabsFor('PLATFORM_ADMIN').map((t) => t.path);
  assert.ok(paths.includes('/platform'));
  assert.deepEqual(paths.sort(), ['/manager', '/installer-checks', '/engineer', '/platform'].sort());
});
test('19 AppTabBar.vue source actually implements this selection (not silently diverged)', async () => {
  const source = await readFile(new URL('../src/components/common/AppTabBar.vue', import.meta.url), 'utf8');
  assert.match(source, /role\.value === 'FARMER' \|\| role\.value === 'MANAGER'/);
  assert.match(source, /workspaceNavigation\.filter\(\(item\) => canAccess\(item\.roles, role\.value\)\)/);
});

// --- Desktop role-aware navigation (section 24) ---
function desktopNavFor(rawRole) {
  const role = permissions.canonicalRole(rawRole);
  // UX-1E: App.vue's real visibleNavigation also folds in desktopSecondaryNavigation (数据/reports).
  const combined = [...navigation.primaryNavigation, ...navigation.desktopSecondaryNavigation, ...navigation.workspaceNavigation].filter((item) => permissions.canAccess(item.roles, role));
  if (role === 'FARMER' || role === 'MANAGER') return combined;
  const defaultPath = roleNav.getDefaultRouteForRole(role);
  return [...combined].sort((a, b) => Number(b.path === defaultPath) - Number(a.path === defaultPath));
}
test('20 FARMER desktop nav: farm-operation only, no workspace entries', () => {
  // UX-1E: desktop also gains 数据(/reports) via desktopSecondaryNavigation, and
  // 农事(/farm-records) was replaced by 告警(/alerts) -- see note on test 14.
  const paths = desktopNavFor('FARMER').map((i) => i.path);
  assert.deepEqual(paths, ['/cockpit', '/map', '/operations', '/alerts', '/profile', '/reports']);
});
test('21 MANAGER desktop nav: farm-operation + manager workspace, not engineer/platform', () => {
  const paths = desktopNavFor('FARM_MANAGER').map((i) => i.path);
  assert.ok(paths.includes('/manager'));
  for (const forbidden of ['/engineer', '/platform', '/installer-checks']) assert.ok(!paths.includes(forbidden));
});
test('22 INSTALLER desktop nav: installer workspace present and default-focus first, no unauthorized widening', () => {
  const paths = desktopNavFor('INSTALLER').map((i) => i.path);
  assert.ok(paths.includes('/installer-checks'));
  for (const forbidden of ['/engineer', '/platform', '/manager']) assert.ok(!paths.includes(forbidden));
  assert.equal(paths[0], '/installer-checks');
});
test('23 ENGINEER desktop nav: engineer + currently-authorized installer tooling, default-focus on engineer', () => {
  const paths = desktopNavFor('MAINTAINER').map((i) => i.path);
  assert.ok(paths.includes('/engineer'));
  assert.ok(paths.includes('/installer-checks'));
  assert.ok(!paths.includes('/platform'));
  assert.ok(!paths.includes('/manager'));
  assert.equal(paths[0], '/engineer');
});
test('24 SUPER_ADMIN desktop nav: all currently-authorized workspace entries, default-focus on platform', () => {
  const paths = desktopNavFor('PLATFORM_ADMIN').map((i) => i.path);
  for (const expected of ['/manager', '/installer-checks', '/engineer', '/platform']) assert.ok(paths.includes(expected));
  assert.equal(paths[0], '/platform');
});
test('25 ENGINEER/SUPER_ADMIN retain farm-operation context routes (cross-context access preserved)', () => {
  for (const role of ['MAINTAINER', 'PLATFORM_ADMIN']) {
    const paths = desktopNavFor(role).map((i) => i.path);
    for (const farmRoute of navigation.primaryNavigation.map((i) => i.path)) {
      assert.ok(paths.includes(farmRoute), `${role} lost farm-context route ${farmRoute}`);
    }
  }
});
test('26 App.vue source actually implements default-focus reordering (not silently diverged)', async () => {
  const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  assert.match(source, /role\.value === 'FARMER' \|\| role\.value === 'MANAGER'/);
  assert.match(source, /getDefaultRouteForRole\(role\.value\)/);
});

// --- LoginPage wiring ---
test('27 LoginPage no longer hardcodes /profile as the universal post-login fallback', async () => {
  const source = await readFile(new URL('../src/pages/LoginPage.vue', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /:\s*'\/profile'/, 'must not hardcode /profile as a landing fallback');
  assert.match(source, /resolveLandingRoute/);
});

let passed = 0;
for (const item of tests) {
  try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; }
}
console.log(`UX-1B ROLE NAVIGATION: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;

await rm(scratchDir, { recursive: true, force: true });
