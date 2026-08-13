<template>
  <section class="panel drone-import-panel">
    <div class="card-topline">
      <strong>无人机作业导入</strong>
      <div class="segmented">
        <button type="button" :class="{ active: mode === 'file' }" @click="mode = 'file'">文件</button>
        <button type="button" :class="{ active: mode === 'json' }" @click="mode = 'json'">JSON</button>
      </div>
    </div>

    <div v-if="mode === 'file'" class="form-grid">
      <input v-model="form.farmId" placeholder="农场编号" />
      <input v-model="form.fieldId" placeholder="田块编号（可选）" />
      <select v-model="form.source">
        <option>DJI_SMARTFARM</option>
        <option>DJI_TERRA</option>
        <option>DJI_PILOT</option>
        <option>KML</option>
        <option>GEOJSON</option>
        <option>CSV</option>
      </select>
      <select v-model="form.operationType">
        <option value="SPRAYING">喷洒</option>
        <option value="MAPPING">测绘</option>
        <option value="SCOUTING">巡田</option>
        <option value="SPREADING">撒播</option>
        <option value="SEEDING">播种</option>
      </select>
      <input v-model="form.droneModel" placeholder="无人机型号，例如 DJI Agras T50" />
      <input v-model="form.chemicalName" placeholder="药剂或肥料名称" />
      <input v-model="form.sprayVolumeL" placeholder="喷施用量（升）" inputmode="decimal" />
      <input type="file" accept=".kml,.geojson,.json,.csv,.kmz,.zip,.tif,.tiff,.tfw" @change="onFileChange" />
      <button class="icon-button" type="button" @click="submitFile">上传</button>
    </div>

    <template v-else>
      <textarea v-model="text" class="json-input" spellcheck="false"></textarea>
      <button class="icon-button wide" type="button" @click="submitJson">导入 JSON</button>
    </template>

    <p v-if="message" class="subtle">{{ message }}</p>
    <div v-if="lastResult" class="import-result">
      <div class="metric-grid tight">
        <div class="metric-card"><span>任务</span><strong>{{ translateStatusLabel(lastResult.importJob?.status ?? '--') }}</strong></div>
        <div class="metric-card"><span>状态</span><strong>{{ translateStatusLabel(lastResult.operation?.status ?? '--') }}</strong></div>
        <div class="metric-card"><span>面积</span><strong>{{ format(lastResult.operation?.actualAreaMu) }} 亩</strong></div>
        <div class="metric-card"><span>覆盖率</span><strong>{{ percent(lastResult.operation?.coverageRate) }}</strong></div>
        <div class="metric-card"><span>航线</span><strong>{{ format(lastResult.operation?.flightDistanceM) }} 米</strong></div>
        <div class="metric-card"><span>图层</span><strong>{{ lastResult.mapLayers?.length ?? 0 }}</strong></div>
      </div>
      <p v-if="needsManualLink" class="warning-text">该作业需要手动关联田块后，才能在报表中使用。</p>
      <p v-if="lastResult.limitation" class="warning-text">{{ lastResult.limitation }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { importDroneOperation, importDroneOperationFile } from '../../api/drone-api';
import { translateStatusLabel } from '../../services/status-translation';

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
    message.value = '请先选择无人机作业文件。';
    return;
  }
  const formData = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (value) formData.append(key, value);
  });
  formData.append('file', selectedFile.value);
  const result = await importDroneOperationFile(formData);
  lastResult.value = result.data;
  message.value = result.isMock ? '（模拟数据）文件导入完成。' : '文件导入完成。';
  emit('imported');
}

async function submitJson() {
  try {
    const payload = JSON.parse(text.value);
    const result = await importDroneOperation(payload);
    lastResult.value = result.data;
    message.value = result.isMock ? '（模拟数据）JSON 导入完成。' : 'JSON 导入完成。';
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
