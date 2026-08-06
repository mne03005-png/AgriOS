import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const router = read('src/router/index.ts');
const nav = read('src/config/navigation.ts');
const http = read('src/api/http.ts');
const state = read('src/services/data-state.ts');
const danger = read('src/services/dangerous-operation.ts');
const css = read('src/styles/mobile.css');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const sw = read('public/sw.js');

for (const path of ['/cockpit', '/map', '/operations', '/farm-records', '/profile']) assert.match(nav, new RegExp(path.replace('/', '\\/')));
for (const role of ['FARMER', 'MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN']) assert.match(read('src/services/permissions.ts'), new RegExp(role));
assert.match(router, /roles: \['ENGINEER', 'SUPER_ADMIN'\]/);
assert.match(router, /path: '\/forbidden'/);
assert.match(http, /mockAllowed\(\) && fallback !== undefined/);
assert.match(http, /OFFLINE_COMMAND_BLOCKED/);
for (const status of ['LOADING', 'LIVE', 'STALE', 'EMPTY', 'OFFLINE', 'ERROR', 'MOCK']) assert.match(state, new RegExp(status));
assert.match(danger, /请输入操作原因/);
assert.match(danger, /re-auth token/);
assert.match(css, /max-width: 767px/);
assert.match(css, /min-width: 768px.*max-width: 1199px/s);
assert.match(css, /min-width: 1200px/);
assert.equal(manifest.display, 'standalone');
assert.match(sw, /request\.method !== 'GET'/);
console.log('Phase A frontend security and responsive contracts: PASS');
