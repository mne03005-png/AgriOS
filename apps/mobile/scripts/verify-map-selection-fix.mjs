import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Field-map selection bug fix: a boundary detail card (FieldBottomSheet) stayed selected
// indefinitely -- auto-selected on load, never cleared on blank-map click, never cleared when
// its layer was hidden, and survived a 地图/列表 round trip. This script exercises the real
// mapStore module (compiled from TypeScript, not regex-matched) so the reactive selection state
// machine is genuinely tested, plus source-level checks for the two behaviors that live in
// MapPage.vue's script (blank-click clearing, viewMode-switch clearing) where a full component
// mount isn't available in this repo's test harness.
const scratchDir = await mkdtemp(path.join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '.map-selection-scratch-'));

async function compileTo(relSourcePath, outFileName) {
  const source = await readFile(new URL(relSourcePath, import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  javascript = javascript.replace(/from '(\.\.?\/[^']+)'/g, (_match, specifier) => `from './${specifier.split('/').pop()}.mjs'`);
  // Plain Node ESM has no import.meta.env (that's a Vite build-time feature); every VITE_* read
  // becomes undefined here, which correctly mirrors "no env var configured" in production.
  javascript = javascript.replace(/import\.meta\.env\.[A-Z_]+/g, 'undefined');
  await writeFile(path.join(scratchDir, outFileName), javascript, 'utf8');
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

let exitCode = 0;
let mapStoreModule;
let mobileApiModule;
try {
  // Real mock-data.ts, compiled as-is -- no network involved.
  await compileTo('../src/api/mock-data.ts', 'mock-data.mjs');

  // Hand-written test double for the network layer map.store.ts imports (getMap). The real
  // mobile-api.ts transitively pulls in http.ts's import.meta.env/fetch usage, which has no
  // meaningful value outside a Vite build; stubbing at this boundary is the same thing a real
  // unit test would do (mock the network), not a rewrite of the behavior under test.
  await writeFile(
    path.join(scratchDir, 'mobile-api.mjs'),
    `
    import { defaultFarmId, mockMap } from './mock-data.mjs';
    export const fixtures = { nextMapData: null };
    export const getMap = async (farmId = defaultFarmId) => {
      const data = fixtures.nextMapData ?? mockMap;
      return { data, source: 'LIVE', status: 'LIVE', lastUpdatedAt: new Date().toISOString(), freshness: 'CURRENT', errorCode: null, errorMessage: null, retryable: false, isMock: false, path: '/mobile/map' };
    };
    `,
    'utf8'
  );

  await compileTo('../src/stores/map.store.ts', 'map.store.mjs');

  globalThis.localStorage = (() => {
    let store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  })();
  mapStoreModule = await import(pathToFileURL(path.join(scratchDir, 'map.store.mjs')));
  mobileApiModule = await import(pathToFileURL(path.join(scratchDir, 'mobile-api.mjs')));
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}

const mapPageSrc = await readSrc('../src/pages/MapPage.vue');
const fieldBottomSheetSrc = await readSrc('../src/components/map/FieldBottomSheet.vue');

const boundaryA = { id: 'boundary-a', name: '洋葱A区边界', fieldId: 'field-a' };
const boundaryB = { id: 'boundary-b', name: '洋葱B区边界', fieldId: 'field-b' };

function freshStore() {
  // map.store.ts exports a single shared singleton; re-import isn't practical mid-suite, so each
  // test explicitly resets the mutable fields it cares about instead of relying on module reload.
  const { mapStore } = mapStoreModule;
  mapStore.clearSelection();
  mapStore.mapData = { fieldBoundaries: [] };
  mapStore.activeLayers.FIELD = true;
  return mapStore;
}

test('1 no auto-selection on initial load: loadMapData() never sets selectedField from fetched data on its own', async () => {
  const mapStore = freshStore();
  mobileApiModule.fixtures.nextMapData = { fieldBoundaries: [boundaryA, boundaryB] };
  assert.equal(mapStore.selectedField, null, 'precondition: nothing selected before load');
  await mapStore.loadMapData('farm-1');
  assert.equal(mapStore.selectedField, null, 'loadMapData() must not auto-select the first (or any) boundary');
  assert.equal(mapStore.selectedBoundary, null);
});

test('2 click boundary shows card: selectField() sets selectedField, and FieldBottomSheet only renders when a field is set', async () => {
  const mapStore = freshStore();
  mapStore.selectField(boundaryA, 'FIELD');
  // mapStore is a Vue reactive() proxy: an assigned object is wrapped, not the same reference,
  // so identity is checked via .id rather than object equality.
  assert.equal(mapStore.selectedField?.id, boundaryA.id);
  assert.equal(mapStore.selectedLayerType, 'FIELD');
  assert.match(fieldBottomSheetSrc, /<section v-if="field" class="bottom-sheet">/, 'the detail card must be conditionally rendered on the field prop, not always mounted');
});

test('3 click blank map clears card: MapPage onMapClick calls clearSelection() outside drawing mode', () => {
  const onMapClickBlock = mapPageSrc.match(/adapter\.onMapClick\(\(point\) => \{([\s\S]*?)\n  \}\);/)[1];
  assert.match(onMapClickBlock, /if \(mapStore\.drawingMode\) \{[\s\S]*?return;\s*\}/, 'drawing-mode clicks must return early, not fall through to clearing');
  assert.match(onMapClickBlock, /clearSelection\(\);/, 'a non-drawing map click must clear the current selection');
});

test('4 close button clears card: FieldBottomSheet emits close, MapPage wires it to clearSelection', () => {
  assert.match(fieldBottomSheetSrc, /defineEmits<\{ close: \[\] \}>\(\);/, 'FieldBottomSheet must declare a close emit');
  assert.match(fieldBottomSheetSrc, /<button[^>]*@click="\$emit\('close'\)"/, 'the close button must actually emit close');
  assert.match(mapPageSrc, /<FieldBottomSheet[^>]*@close="clearSelection"/, "MapPage must wire FieldBottomSheet's close event to clearSelection");
});

test('5 hiding layer clears selected feature: toggleLayer() clears the selection when it owns the layer being turned off', () => {
  const mapStore = freshStore();
  mapStore.selectField(boundaryA, 'FIELD');
  assert.equal(mapStore.selectedField?.id, boundaryA.id);
  mapStore.toggleLayer('FIELD');
  assert.equal(mapStore.activeLayers.FIELD, false, 'precondition: layer actually turned off');
  assert.equal(mapStore.selectedField, null, 'selection must clear the instant its owning layer is hidden');
  assert.equal(mapStore.selectedBoundary, null);
  assert.equal(mapStore.selectedLayerType, null);
});

test('5b hiding an unrelated layer must not clear a selection that belongs to a different layer', () => {
  const mapStore = freshStore();
  mapStore.selectField(boundaryA, 'FIELD');
  mapStore.toggleLayer('IRRIGATION_ZONE');
  assert.equal(mapStore.selectedField?.id, boundaryA.id, 'an unrelated layer toggle must not touch an existing selection');
});

test('6 stale selection after data reload: a selected boundary no longer present in freshly loaded data is cleared, not left stale', async () => {
  const mapStore = freshStore();
  mapStore.selectField(boundaryA, 'FIELD');
  mobileApiModule.fixtures.nextMapData = { fieldBoundaries: [boundaryB] }; // boundaryA no longer present
  await mapStore.loadMapData('farm-1');
  assert.equal(mapStore.selectedField, null, 'a selection whose boundary vanished from the reloaded data must not remain on screen');
});

test('6b a still-present selection survives a reload untouched (no unnecessary flicker/clear)', async () => {
  const mapStore = freshStore();
  mapStore.selectField(boundaryA, 'FIELD');
  mobileApiModule.fixtures.nextMapData = { fieldBoundaries: [boundaryA, boundaryB] };
  await mapStore.loadMapData('farm-1');
  assert.equal(mapStore.selectedField?.id, boundaryA.id, 'a boundary that still exists after reload must not be cleared');
});

test('7 switching 地图/列表 does not preserve stale selection: MapPage watches viewMode and clears on every change', () => {
  assert.match(mapPageSrc, /watch\(viewMode, clearSelection\);/, 'viewMode changes (either direction) must clear the current selection');
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
console.log(`MAP SELECTION FIX: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
