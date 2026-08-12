import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// UX-1A route/link integrity baseline. Establishes automated protection around the CURRENT
// router BEFORE UX-1B restructures navigation. Deliberately does NOT hardcode a duplicate
// route list: it parses the real router/index.ts routes array and the real navigation/page
// consumers (config/navigation.ts, RouterLink `to=`, router.push/replace, and `path:` entries
// feeding `:to="item.path"` bindings), so this test tracks the actual source instead of
// drifting from it independently.

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const read = (relPath) => readFileSync(path.join(srcDir, relPath), 'utf8');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(vue|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

// --- 1. Parse the real router routes array (source of truth) ---
const routerSource = read('router/index.ts');
const routesArrayMatch = routerSource.match(/routes:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/);
assert.ok(routesArrayMatch, 'could not locate the routes array in router/index.ts -- router structure changed unexpectedly');
const routesArrayBody = routesArrayMatch[1];

const routeLines = routesArrayBody.split('\n').map((line) => line.trim()).filter((line) => line.includes('path:'));
const routes = routeLines.map((line) => {
  const pathMatch = line.match(/path:\s*'([^']*)'/);
  assert.ok(pathMatch, `route line did not contain a parseable path: ${line}`);
  return { raw: line, routePath: pathMatch[1], pageBacked: line.includes('component:') };
});

const routePaths = routes.map((r) => r.routePath);
const dynamicRoutePaths = routePaths.filter((p) => p.includes(':') && !p.includes('pathMatch'));
const pageBackedCount = routes.filter((r) => r.pageBacked).length;
const nonPageCount = routes.length - pageBackedCount;

assert.equal(routes.length, 30, `expected 30 total route entries (UX-1A baseline), found ${routes.length}`);
assert.equal(pageBackedCount, 28, `expected 28 page-backed routes (UX-1A baseline), found ${pageBackedCount}`);
assert.equal(nonPageCount, 2, `expected 2 non-page redirect/catch-all entries (UX-1A baseline), found ${nonPageCount}`);

function resolves(target) {
  if (routePaths.includes(target)) return true;
  // dynamic-segment template literal target, e.g. "/fields/" from `/fields/${id}`
  return dynamicRoutePaths.some((dynamicPath) => dynamicPath.startsWith(target));
}

// --- 2. Extract literal navigation targets from every real consumer in src/ ---
const files = walk(srcDir);
/** @type {{ file: string, target: string }[]} */
const discovered = [];

for (const file of files) {
  if (file === path.join(srcDir, 'router', 'index.ts')) continue; // the source of truth itself, not a consumer
  const relFile = path.relative(srcDir, file);
  const text = readFileSync(file, 'utf8');

  for (const m of text.matchAll(/(?:^|[^:])\bto="([^"]+)"/g)) discovered.push({ file: relFile, target: m[1] });
  for (const m of text.matchAll(/:to="`([^`"]+)`"/g)) discovered.push({ file: relFile, target: templatePrefix(m[1]) });
  for (const m of text.matchAll(/router\.(?:push|replace)\('([^']*)'\)/g)) discovered.push({ file: relFile, target: m[1] });
  for (const m of text.matchAll(/path:\s*'([^']*)'/g)) discovered.push({ file: relFile, target: m[1] });
  for (const m of text.matchAll(/path:\s*`([^`]*)`/g)) discovered.push({ file: relFile, target: templatePrefix(m[1]) });
}

function templatePrefix(templateBody) {
  const idx = templateBody.indexOf('${');
  return idx === -1 ? templateBody : templateBody.slice(0, idx);
}

const stripQuery = (target) => target.split('?')[0];
const unresolved = discovered.filter((d) => d.target.startsWith('/') && !resolves(stripQuery(d.target)));
assert.deepEqual(unresolved, [], `found navigation targets that do not resolve against any registered route:\n${unresolved.map((u) => `  ${u.file}: ${u.target}`).join('\n')}`);
assert.ok(discovered.length > 20, `expected substantially more than 20 discovered navigation targets across real consumers, found ${discovered.length} -- extraction may be broken`);

// --- 3. Explicit anchors required by the UX-1A baseline (section 13) ---
const navigationSource = read('config/navigation.ts');
const primaryNavBlock = navigationSource.match(/export const primaryNavigation[\s\S]*?\n\];/)[0];
const workspaceNavBlock = navigationSource.match(/export const workspaceNavigation[\s\S]*?\n\];/)[0];
const primaryNavPaths = [...primaryNavBlock.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);
const workspaceNavPaths = [...workspaceNavBlock.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);

assert.ok(primaryNavPaths.length >= 5, 'expected at least 5 primary navigation entries');
for (const p of primaryNavPaths) assert.ok(resolves(p), `primary navigation path does not resolve: ${p}`);

assert.ok(workspaceNavPaths.length >= 4, 'expected at least 4 workspace navigation entries');
for (const p of workspaceNavPaths) assert.ok(resolves(p), `workspace navigation path does not resolve: ${p}`);

for (const dynamic of ['/fields/:fieldId', '/operation-reports/:id']) {
  assert.ok(routePaths.includes(dynamic), `dynamic route no longer registered: ${dynamic}`);
}
for (const anchor of ['/login', '/forbidden']) {
  assert.ok(routePaths.includes(anchor), `auth/error anchor no longer registered: ${anchor}`);
}
for (const workspace of ['/manager', '/engineer', '/installer-checks', '/platform']) {
  assert.ok(routePaths.includes(workspace), `workspace route no longer registered: ${workspace}`);
}
assert.ok(routePaths.includes('/valve-control-test'), 'engineer dry-run tool route no longer registered: /valve-control-test');

console.log(`UX-1A ROUTE/LINK INTEGRITY: PASS routes=${routes.length} page_backed=${pageBackedCount} non_page=${nonPageCount} discovered_targets=${discovered.length} unresolved=${unresolved.length}`);
