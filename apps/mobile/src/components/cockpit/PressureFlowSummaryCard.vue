<template>
  <section class="panel compact-panel">
    <div class="card-topline">
      <strong>Pressure / Flow</strong>
      <span class="subtle">latest telemetry</span>
    </div>
    <div class="metric-grid tight">
      <div class="metric-card">
        <span>Pressure</span>
        <strong>{{ pressure }} kPa</strong>
      </div>
      <div class="metric-card">
        <span>Flow</span>
        <strong>{{ flow }} m3/h</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ pressureSummary?: any; flowSummary?: any }>();
const pressure = props.pressureSummary?.avgKpa ?? props.pressureSummary?.latest?.pressureKpa ?? '--';
const flow = props.flowSummary?.avgM3h ?? props.flowSummary?.latest?.flowRateM3h ?? '--';
</script>
