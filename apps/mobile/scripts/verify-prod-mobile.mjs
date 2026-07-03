import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function assertContains(file, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${file} does not contain expected text: ${expected}`);
  }
}

function assertNotContains(file, source, unexpected) {
  if (source.includes(unexpected)) {
    throw new Error(`${file} contains forbidden text: ${unexpected}`);
  }
}

function listFiles(path) {
  if (!existsSync(path)) return [];
  const entry = statSync(path);
  if (entry.isFile()) return [path];
  return readdirSync(path).flatMap((child) => listFiles(resolve(path, child)));
}

const router = read('src/router/index.ts');
assertContains('src/router/index.ts', router, "createWebHistory(resolveRouterBase())");
assertContains('src/router/index.ts', router, "window.location.pathname.startsWith('/mobile')");
assertContains('src/router/index.ts', router, "window.location.hostname === 'agrios.xyzwtt.com'");
assertContains('src/router/index.ts', router, "path: '/login', component: LoginPage, meta: { public: true }");
assertContains('src/router/index.ts', router, "path: '/change-password', component: ChangePasswordPage");
assertContains('src/router/index.ts', router, "path: '/:pathMatch(.*)*', redirect: '/cockpit'");
assertContains('src/router/index.ts', router, "query: { redirect: to.fullPath }");
assertNotContains('src/router/index.ts', router, 'VITE_AUTH_TOKEN');

const http = read('src/api/http.ts');
assertContains('src/api/http.ts', http, 'https://agrios-api.xyzwtt.com/api/v1');
assertContains('src/api/http.ts', http, 'import.meta.env.DEV && env.VITE_AUTH_TOKEN');

const login = read('src/pages/LoginPage.vue');
assertContains('src/pages/LoginPage.vue', login, "useRoute");
assertContains('src/pages/LoginPage.vue', login, "route.query.redirect");
assertContains('src/pages/LoginPage.vue', login, "router.replace(redirect)");

const changePassword = read('src/pages/ChangePasswordPage.vue');
assertContains('src/pages/ChangePasswordPage.vue', changePassword, "changePassword(authStore.token");
assertContains('src/pages/ChangePasswordPage.vue', changePassword, "authStore.setSession(result.accessToken, result.user)");

const sentinelToken = 'prod-fixed-auth-token-sentinel-do-not-ship';
const isWindows = process.platform === 'win32';
const build = isWindows ? spawnSync('npx.cmd vite build', {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    VITE_BASE_PATH: '/mobile/',
    VITE_AUTH_TOKEN: sentinelToken
  },
  shell: true,
  stdio: 'inherit'
}) : spawnSync('npx', ['vite', 'build'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    VITE_BASE_PATH: '/mobile/',
    VITE_AUTH_TOKEN: sentinelToken
  },
  stdio: 'inherit'
});

if (build.status !== 0) {
  if (build.error) throw build.error;
  throw new Error('Production mobile verification build failed.');
}

for (const file of listFiles(resolve(root, 'dist'))) {
  const content = readFileSync(file, 'utf8');
  assertNotContains(file, content, sentinelToken);
  assertNotContains(file, content, 'VITE_AUTH_TOKEN');
}

console.log('Production mobile routing and auth-token checks passed.');
