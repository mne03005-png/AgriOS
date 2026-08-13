<template>
  <section class="panel compact-panel">
    <div class="card-topline">
      <strong>无人机作业覆盖汇总</strong>
      <span class="subtle">{{ operations.length }} 条记录</span>
    </div>
    <div class="metric-grid tight">
      <div class="metric-card"><span>总面积</span><strong>{{ totalArea }} 亩</strong></div>
      <div class="metric-card"><span>平均覆盖率</span><strong>{{ avgCoverage }}%</strong></div>
      <div class="metric-card"><span>药剂用量</span><strong>{{ totalChemical }} 升</strong></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ operations: any[] }>();
const totalArea = computed(() => sum('actualAreaMu'));
const totalChemical = computed(() => sum('sprayVolumeL'));
const avgCoverage = computed(() => {
  const values = props.operations.map((item) => Number(item.coverageRate)).filter(Number.isFinite);
  return values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0;
});

function sum(key: string) {
  return Number(props.operations.reduce((total, item) => total + Number(item[key] ?? 0), 0).toFixed(2));
}
</script>
