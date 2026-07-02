<template>
  <section class="metric-grid">
    <div class="metric-card">
      <span>今日风险</span>
      <strong>{{ data.todayRiskLevel ?? 'NORMAL' }}</strong>
    </div>
    <div class="metric-card">
      <span>灌溉分区</span>
      <strong>{{ data.activeIrrigationZones ?? 0 }}</strong>
    </div>
    <div class="metric-card">
      <span>今日用水</span>
      <strong>{{ data.todayWaterUsage ?? 0 }}</strong>
    </div>
    <div class="metric-card warn">
      <span>待处理告警</span>
      <strong>{{ data.pendingAlerts ?? 0 }}</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ data: any }>();
</script>
