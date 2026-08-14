import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// NATIVE-MAP-1 section 20 focused tests. Mirrors apps/mobile/scripts/verify-map-selection-fix.mjs's
// approach: compile the real TypeScript stores (not a rewritten copy) and exercise them directly,
// plus source-level checks for wiring that isn't practical to unit-test without a full RN render
// harness (map press handlers, provider defaults, no-fabricated-data guarantees).
const scratchDir = await mkdtemp(path.join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '.native-map-1-scratch-'));

async function compileTo(relSourcePath, outFileName) {
  const source = await readFile(new URL(relSourcePath, import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  javascript = javascript.replace(/from '(\.\.?\/[^']+)'/g, (_match, specifier) => `from './${specifier.split('/').pop()}.mjs'`);
  await writeFile(path.join(scratchDir, outFileName), javascript, 'utf8');
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const readSrc = (relPath) => readFile(new URL(relPath, import.meta.url), 'utf8');

let exitCode = 0;
let mapStoreModule;
let mobileApiModule;
try {
  await writeFile(
    path.join(scratchDir, 'zustand.mjs'),
    `
    export function create(initializer) {
      let state;
      const listeners = new Set();
      const set = (partial) => {
        const next = typeof partial === 'function' ? partial(state) : partial;
        state = { ...state, ...next };
        listeners.forEach((listener) => listener(state));
      };
      const get = () => state;
      const api = { setState: set, getState: get, subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)) };
      state = initializer(set, get, api);
      const useStore = (selector) => (selector ? selector(state) : state);
      useStore.getState = get;
      useStore.setState = set;
      return useStore;
    }
    `,
    'utf8'
  );

  await writeFile(
    path.join(scratchDir, 'mobile-api.mjs'),
    `
    export const fixtures = { nextMapData: null };
    export const getMap = async (farmId) => fixtures.nextMapData;
    `,
    'utf8'
  );

  await compileTo('../src/stores/map.store.ts', 'map.store.mjs');
  mapStoreModule = await import(pathToFileURL(path.join(scratchDir, 'map.store.mjs')));
  mobileApiModule = await import(pathToFileURL(path.join(scratchDir, 'mobile-api.mjs')));
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}

const fieldMapViewSrc = await readSrc('../src/components/map/FieldMapView.tsx');
const fieldDetailSheetSrc = await readSrc('../src/components/map/FieldDetailSheet.tsx');
const fieldsScreenSrc = await readSrc('../src/screens/FieldsScreen.tsx');
const httpSrc = await readSrc('../src/api/http.ts');
const gisApiSrc = await readSrc('../src/api/gis-api.ts');
const mobileApiSrc = await readSrc('../src/api/mobile-api.ts');
const appJsonSrc = await readSrc('../app.json');

const boundaryA = { id: 'boundary-a', name: '洋葱A区边界', fieldId: 'field-a', status: 'APPROVED' };
const boundaryB = { id: 'boundary-b', name: '洋葱B区边界', fieldId: 'field-b', status: 'APPROVED' };
const emptyMapData = { fieldBoundaries: [] };

function freshStore() {
  const store = mapStoreModule.useMapStore;
  store.setState({ selectedFeature: null, selectedLayerType: null, mapData: emptyMapData, activeLayers: { ...store.getState().activeLayers, FIELD: true } });
  return store;
}

test('1 no auto-selection on initial load: loadMapData() never sets selectedFeature from fetched data on its own', async () => {
  const store = freshStore();
  mobileApiModule.fixtures.nextMapData = { fieldBoundaries: [boundaryA, boundaryB] };
  assert.equal(store.getState().selectedFeature, null, 'precondition: nothing selected before load');
  await store.getState().loadMapData('farm-1');
  assert.equal(store.getState().selectedFeature, null, 'loadMapData() must not auto-select the first (or any) boundary');
});

test('2 explicit selectFeature() sets selectedFeature and selectedLayerType', () => {
  const store = freshStore();
  store.getState().selectFeature(boundaryA, 'FIELD');
  assert.equal(store.getState().selectedFeature?.id, boundaryA.id);
  assert.equal(store.getState().selectedLayerType, 'FIELD');
});

test('3 clearSelection() resets both fields', () => {
  const store = freshStore();
  store.getState().selectFeature(boundaryA, 'FIELD');
  store.getState().clearSelection();
  assert.equal(store.getState().selectedFeature, null);
  assert.equal(store.getState().selectedLayerType, null);
});

test('4 stale selection after data reload is cleared: a selected boundary no longer present in freshly loaded data is cleared, not left stale', async () => {
  const store = freshStore();
  store.getState().selectFeature(boundaryA, 'FIELD');
  mobileApiModule.fixtures.nextMapData = { fieldBoundaries: [boundaryB] };
  await store.getState().loadMapData('farm-1');
  assert.equal(store.getState().selectedFeature, null, 'a selection whose boundary vanished from the reloaded data must not remain');
});

test('4b a still-present selection survives a reload untouched', async () => {
  const store = freshStore();
  store.getState().selectFeature(boundaryA, 'FIELD');
  mobileApiModule.fixtures.nextMapData = { fieldBoundaries: [boundaryA, boundaryB] };
  await store.getState().loadMapData('farm-1');
  assert.equal(store.getState().selectedFeature?.id, boundaryA.id, 'a boundary that still exists after reload must not be cleared');
});

test('5 hiding the owning layer clears the selection: toggleLayer() clears when it owns the current selection', () => {
  const store = freshStore();
  store.getState().selectFeature(boundaryA, 'FIELD');
  store.getState().toggleLayer('FIELD');
  assert.equal(store.getState().activeLayers.FIELD, false, 'precondition: layer actually turned off');
  assert.equal(store.getState().selectedFeature, null, 'selection must clear the instant its owning layer is hidden');
});

test('5b hiding an unrelated layer must not clear a selection that belongs to a different layer', () => {
  const store = freshStore();
  store.getState().selectFeature(boundaryA, 'FIELD');
  store.getState().toggleLayer('IRRIGATION_ZONE');
  assert.equal(store.getState().selectedFeature?.id, boundaryA.id, 'an unrelated layer toggle must not touch an existing selection');
});

test('6 blank-map tap clears selection: FieldMapView wires MapView onPress to handleMapPress -> clearSelection', () => {
  assert.match(fieldMapViewSrc, /onPress=\{handleMapPress\}/, 'MapView must wire onPress to handleMapPress');
  assert.match(fieldMapViewSrc, /function handleMapPress\(\)[\s\S]*?clearSelection\(\);/, 'a non-ignored map press must call clearSelection()');
});

test('7 boundary tap selects: Polygon onPress wired to handleBoundaryPress -> selectFeature', () => {
  assert.match(fieldMapViewSrc, /onPress=\{\(\) => handleBoundaryPress\(boundary\)\}/, 'each field boundary Polygon must be tappable and call handleBoundaryPress');
  assert.match(fieldMapViewSrc, /function handleBoundaryPress\(boundary: FieldBoundary\)[\s\S]*?selectFeature\(boundary, 'FIELD'\);/);
});

test('8 close button clears selection: FieldDetailSheet exposes onClose, FieldMapView wires it to clearSelection', () => {
  assert.match(fieldDetailSheetSrc, /onPress=\{onClose\}/, 'the close button must call the onClose prop');
  assert.match(fieldMapViewSrc, /<FieldDetailSheet boundary=\{selectedFeature\} onClose=\{clearSelection\}/, 'FieldMapView must wire FieldDetailSheet.onClose to clearSelection');
});

test('9 switching 地图/列表 clears selection: FieldsScreen clears on every viewMode change', () => {
  assert.match(fieldsScreenSrc, /useEffect\(\(\) => \{\s*clearSelection\(\);\s*\}, \[viewMode, clearSelection\]\);/, 'viewMode changes must clear the current selection');
});

test('10 no coordinate-system mutation for Apple Maps: FieldMapView never imports the GCJ-02 conversion used by the Web AMap adapter', () => {
  assert.doesNotMatch(fieldMapViewSrc, /gcj02|wgs84ToGcj02|coordinate-transform/i);
});

test('11 iOS provider default is Apple Maps: FieldMapView never sets PROVIDER_GOOGLE or a `provider` prop', () => {
  assert.doesNotMatch(fieldMapViewSrc, /PROVIDER_GOOGLE/);
  assert.doesNotMatch(fieldMapViewSrc, /provider=/);
});

test('12 no fabricated Google Maps API key: app.json does not declare android.config.googleMaps.apiKey', () => {
  const parsed = JSON.parse(appJsonSrc);
  assert.equal(parsed.expo?.android?.config?.googleMaps?.apiKey, undefined, 'no Google Maps key may be fabricated for Android');
});

test('13 real field list is API-backed, not mock: FieldsScreen sources the list from getCockpit(), never a mock/fixture module', () => {
  assert.match(fieldsScreenSrc, /getCockpit\(farmId\)/);
  assert.doesNotMatch(fieldsScreenSrc, /mock/i);
});

test('14 http client never returns fabricated fallback data on error (no mock-as-real-data path)', () => {
  assert.doesNotMatch(httpSrc, /mockAllowed|fallback/i, 'apiRequest must surface real errors to the UI, never silently substitute mock data');
});

test('15 GPS boundary capture submits to the existing GIS endpoint, not a new backend route', () => {
  assert.match(gisApiSrc, /\/gis\/gps-tracks\/import/);
  assert.match(mobileApiSrc, /\/mobile\/map|\/mobile\/cockpit|\/mobile\/operations|\/mobile\/alerts/);
});

test('16 no real-control action introduced: no valve/pump/emergency-stop control strings anywhere in the native map/GPS-capture source', () => {
  const combined = [fieldMapViewSrc, fieldDetailSheetSrc, gisApiSrc, mobileApiSrc].join('\n');
  assert.doesNotMatch(combined, /VALVE_OPEN|VALVE_CLOSE|emergency-stop|emergencyStop|PUMP_ON|PUMP_OFF/);
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
console.log(`NATIVE-MAP-1: ${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
