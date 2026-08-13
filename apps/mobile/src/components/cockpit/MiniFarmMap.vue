<template>
  <RouterLink class="map-card mini-map-link" to="/map">
    <div class="panel-title">农场缩略图</div>
    <div v-if="!layers?.length" class="empty-map">请先创建地块边界</div>
    <svg v-else viewBox="0 0 320 180" role="img" aria-label="农场缩略图">
      <rect x="0" y="0" width="320" height="180" rx="8" fill="#dff7e8" />
      <path d="M24 126 C90 72 155 156 296 58" fill="none" stroke="#2563eb" stroke-width="9" opacity=".5" />
      <polygon points="48,38 150,28 172,105 66,118" :fill="riskColor" opacity=".72" stroke="#0f7a34" stroke-width="3" />
      <polygon points="182,58 276,48 288,130 196,144" fill="#16a34a" opacity=".62" stroke="#0f7a34" stroke-width="3" />
      <circle cx="88" cy="82" r="7" fill="#2563eb" />
      <circle cx="228" cy="96" r="7" fill="#f97316" />
    </svg>
    <div class="layer-pills">
      <span v-for="layer in layers" :key="layer.id ?? layer.name">{{ layer.name ?? translateStatusLabel(layer.type) }}</span>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { translateStatusLabel } from '../../services/status-translation';

const props = defineProps<{ layers: any[]; riskLevel?: string }>();
const riskColor = computed(() => (props.riskLevel === 'HIGH' ? '#f97316' : props.riskLevel === 'CRITICAL' ? '#dc2626' : '#22c55e'));
</script>
