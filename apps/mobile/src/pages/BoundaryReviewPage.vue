<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前为模拟边界数据</div>
    <header class="section-header">
      <div>
        <h1>候选边界审核</h1>
        <p class="subtle">批准后系统会自动生成对应的地块图层</p>
      </div>
    </header>
    <section v-for="item in boundaries" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.name ?? '候选边界' }}</strong>
        <StatusBadge :label="item.status ?? 'CANDIDATE'" tone="warn" />
      </div>
      <svg viewBox="0 0 320 140" class="boundary-preview">
        <rect width="320" height="140" rx="8" fill="#eef8f0" />
        <polygon points="42,36 202,28 250,102 70,116" fill="#16a34a55" stroke="#16a34a" stroke-width="4" />
      </svg>
      <p>面积：{{ item.areaMu ?? item.area ?? '-' }} 亩</p>
      <p>来源：{{ item.source ?? '-' }}</p>
      <div class="button-row">
        <button class="primary-button" @click="approveItem(item.id)">批准</button>
        <button class="secondary-button" @click="archiveItem(item.id)">归档</button>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { approveFieldBoundary, archiveFieldBoundary, getFieldBoundaries } from '../api/gis-api';
import { defaultFarmId, mockMap } from '../api/mock-data';
import StatusBadge from '../components/common/StatusBadge.vue';

const boundaries = ref<any[]>(mockMap.fieldBoundaries);
const isMock = ref(true);

onMounted(load);

async function load() {
  const result = await getFieldBoundaries(defaultFarmId, 'CANDIDATE');
  boundaries.value = Array.isArray(result.data) ? result.data : mockMap.fieldBoundaries;
  isMock.value = result.isMock;
}

async function approveItem(id: string) {
  if (!window.confirm('确认批准该候选边界？')) return;
  await approveFieldBoundary(id);
  await load();
}

async function archiveItem(id: string) {
  if (!window.confirm('确认归档该候选边界？')) return;
  await archiveFieldBoundary(id);
  await load();
}
</script>
