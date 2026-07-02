<template>
  <section class="panel drone-import-panel">
    <div class="card-topline">
      <strong>Drone Import</strong>
      <div class="segmented">
        <button type="button" :class="{ active: mode === 'file' }" @click="mode = 'file'">File</button>
        <button type="button" :class="{ active: mode === 'json' }" @click="mode = 'json'">JSON</button>
      </div>
    </div>

    <div v-if="mode === 'file'" class="form-grid">
      <input v-model="form.farmId" placeholder="farmId" />
      <input v-model="form.fieldId" placeholder="fieldId optional" />
      <select v-model="form.source">
        <option>DJI_SMARTFARM</option>
        <option>DJI_TERRA</option>
        <option>DJI_PILOT</option>
        <option>KML</option>
        <option>GEOJSON</option>
        <option>CSV</option>
      </select>
      <select v-model="form.operationType">
        <option>SPRAYING</option>
        <option>MAPPING</option>
        <option>SCOUTING</option>
        <option>SPREADING</option>
        <option>SEEDING</option>
      </select>
      <input v-model="form.droneModel" placeholder="DJI Agras T50" />
      <input v-model="form.chemicalName" placeholder="chemical or fertilizer" />
      <input v-model="form.sprayVolumeL" placeholder="spray volume L" inputmode="decimal" />
      <input type="file" accept=".kml,.geojson,.json,.csv,.kmz,.zip,.tif,.tiff,.tfw" @change="onFileChange" />
      <button class="icon-button" type="button" @click="submitFile">Upload</button>
    </div>

    <template v-else>
      <textarea v-model="text" class="json-input" spellcheck="false"></textarea>
      <button class="icon-button wide" type="button" @click="submitJson">Import JSON</button>
    </template>

    <p v-if="message" class="subtle">{{ message }}</p>
    <div v-if="lastResult" class="import-result">
      <div class="metric-grid tight">
        <div class="metric-card"><span>Job</span><strong>{{ lastResult.importJob?.status ?? '--' }}</strong></div>
        <div class="metric-card"><span>Status</span><strong>{{ lastResult.operation?.status ?? '--' }}</strong></div>
        <div class="metric-card"><span>Area</span><strong>{{ format(lastResult.operation?.actualAreaMu) }} mu</strong></div>
        <div class="metric-card"><span>Coverage</span><strong>{{ percent(lastResult.operation?.coverageRate) }}</strong></div>
        <div class="metric-card"><span>Route</span><strong>{{ format(lastResult.operation?.flightDistanceM) }} m</strong></div>
        <div class="metric-card"><span>Layers</span><strong>{{ lastResult.mapLayers?.length ?? 0 }}</strong></div>
      </div>
      <p v-if="needsManualLink" class="warning-text">Needs manual field link before this operation can be trusted in reports.</p>
      <p v-if="lastResult.limitation" class="warning-text">{{ lastResult.limitation }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { importDroneOperation, importDroneOperationFile } from '../../api/drone-api';

const emit = defineEmits<{ imported: [] }>();
const mode = ref<'file' | 'json'>('file');
const message = ref('');
const selectedFile = ref<File | null>(null);
const lastResult = ref<any | null>(null);
const form = reactive({
  farmId: 'farm_001',
  fieldId: 'field_001',
  source: 'DJI_SMARTFARM',
  operationType: 'SPRAYING',
  droneModel: 'DJI Agras T50',
  chemicalName: 'demo pesticide',
  sprayVolumeL: '92'
});

const text = ref(JSON.stringify({
  farmId: 'farm_001',
  fieldId: 'field_001',
  source: 'DJI_SMARTFARM',
  fileName: 'operation.geojson',
  fileType: 'GEOJSON',
  coordinateSystem: 'WGS84',
  operationType: 'SPRAYING',
  droneModel: 'DJI Agras T50',
  coverageGeoJson: {
    type: 'Polygon',
    coordinates: [[[118.1, 36.7], [118.12, 36.7], [118.12, 36.72], [118.1, 36.72], [118.1, 36.7]]]
  },
  sprayVolumeL: 92,
  chemicalName: 'demo pesticide'
}, null, 2));

const needsManualLink = computed(() => Boolean(lastResult.value?.operation?.rawJson?.matchResult?.needsManualLink));

function onFileChange(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function submitFile() {
  if (!selectedFile.value) {
    message.value = 'Choose a drone file first.';
    return;
  }
  const formData = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (value) formData.append(key, value);
  });
  formData.append('file', selectedFile.value);
  const result = await importDroneOperationFile(formData);
  lastResult.value = result.data;
  message.value = result.isMock ? 'Mock file import completed.' : 'File import completed.';
  emit('imported');
}

async function submitJson() {
  try {
    const payload = JSON.parse(text.value);
    const result = await importDroneOperation(payload);
    lastResult.value = result.data;
    message.value = result.isMock ? 'Mock JSON import completed.' : 'JSON import completed.';
    emit('imported');
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  }
}

function format(value?: number) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '--';
}

function percent(value?: number) {
  if (!Number.isFinite(Number(value))) return '--';
  const number = Number(value);
  return `${(number > 1 ? number : number * 100).toFixed(1)}%`;
}
</script>
