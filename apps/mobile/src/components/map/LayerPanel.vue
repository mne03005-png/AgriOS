<template>
  <section class="panel layer-panel">
    <div class="panel-title">图层开关</div>
    <label v-for="item in items" :key="item.key" class="layer-toggle">
      <input type="checkbox" :checked="activeLayers[item.key]" @change="$emit('toggle', item.key)" />
      <span class="layer-dot" :style="{ background: item.color }"></span>
      <span>{{ item.label }}</span>
    </label>
  </section>
</template>

<script setup lang="ts">
defineProps<{ activeLayers: Record<string, boolean> }>();
defineEmits<{ toggle: [type: string] }>();

const items = [
  { key: 'FIELD', label: '地块边界', color: '#16a34a' },
  { key: 'IRRIGATION_ZONE', label: '灌溉分区', color: '#2563eb' },
  { key: 'VALVE', label: '阀门', color: '#f97316' },
  { key: 'SENSOR', label: '传感器', color: '#2563eb' },
  { key: 'PUMP', label: '水泵', color: '#0f172a' },
  { key: 'PIPELINE', label: '管线', color: '#60a5fa' },
  { key: 'WATER', label: '水渠', color: '#06b6d4' },
  { key: 'OBSTACLE', label: '障碍物', color: '#dc2626' },
  { key: 'GPS_TRACK', label: 'GPS 轨迹', color: '#84cc16' },
  { key: 'DRONE_ROUTE', label: '无人机航线', color: '#9333ea' },
  { key: 'ORTHOMOSAIC', label: '覆盖/影像/处方', color: '#94a3b8' }
];
</script>
