<template>
  <article class="panel operation-card">
    <div class="card-topline">
      <strong>{{ item.droneModel ?? '无人机' }}</strong>
      <span class="status-pill">{{ translateStatusLabel(item.status ?? 'IMPORTED') }}</span>
    </div>
    <div class="metric-grid tight">
      <div class="metric-card"><span>类型</span><strong>{{ translateStatusLabel(item.operationType) }}</strong></div>
      <div class="metric-card"><span>面积</span><strong>{{ item.actualAreaMu ?? '--' }} 亩</strong></div>
      <div class="metric-card"><span>覆盖率</span><strong>{{ item.coverageRate ?? '--' }}%</strong></div>
      <div class="metric-card"><span>漏喷</span><strong>{{ item.missedAreaMu ?? '--' }} 亩</strong></div>
      <div class="metric-card"><span>重喷</span><strong>{{ item.repeatedAreaMu ?? '--' }} 亩</strong></div>
      <div class="metric-card"><span>航线</span><strong>{{ item.flightDistanceM ?? '--' }} 米</strong></div>
      <div class="metric-card"><span>时长</span><strong>{{ item.flightDurationS ?? '--' }} 秒</strong></div>
      <div class="metric-card"><span>用药量</span><strong>{{ item.sprayVolumeL ?? '--' }} 升</strong></div>
      <div class="metric-card"><span>亩用量</span><strong>{{ item.dosagePerMu ?? '--' }} 升/亩</strong></div>
    </div>
    <p class="subtle">{{ formatTime(item.startedAt) }} - {{ formatTime(item.finishedAt) }}</p>
  </article>
</template>

<script setup lang="ts">
import { translateStatusLabel } from '../../services/status-translation';

defineProps<{ item: any }>();

function formatTime(value?: string) {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}
</script>
