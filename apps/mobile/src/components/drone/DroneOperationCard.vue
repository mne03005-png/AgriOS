<template>
  <article class="panel operation-card">
    <div class="card-topline">
      <strong>{{ item.droneModel ?? 'DJI drone' }}</strong>
      <span class="status-pill">{{ item.status ?? 'IMPORTED' }}</span>
    </div>
    <div class="metric-grid tight">
      <div class="metric-card"><span>Type</span><strong>{{ item.operationType }}</strong></div>
      <div class="metric-card"><span>Area</span><strong>{{ item.actualAreaMu ?? '--' }} mu</strong></div>
      <div class="metric-card"><span>Coverage</span><strong>{{ item.coverageRate ?? '--' }}%</strong></div>
      <div class="metric-card"><span>Missed</span><strong>{{ item.missedAreaMu ?? '--' }} mu</strong></div>
      <div class="metric-card"><span>Repeated</span><strong>{{ item.repeatedAreaMu ?? '--' }} mu</strong></div>
      <div class="metric-card"><span>Route</span><strong>{{ item.flightDistanceM ?? '--' }} m</strong></div>
      <div class="metric-card"><span>Duration</span><strong>{{ item.flightDurationS ?? '--' }} s</strong></div>
      <div class="metric-card"><span>Spray</span><strong>{{ item.sprayVolumeL ?? '--' }} L</strong></div>
      <div class="metric-card"><span>Dosage</span><strong>{{ item.dosagePerMu ?? '--' }} L/mu</strong></div>
    </div>
    <p class="subtle">{{ formatTime(item.startedAt) }} - {{ formatTime(item.finishedAt) }}</p>
  </article>
</template>

<script setup lang="ts">
defineProps<{ item: any }>();

function formatTime(value?: string) {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}
</script>
