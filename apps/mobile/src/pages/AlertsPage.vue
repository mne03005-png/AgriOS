<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">Current alerts are mock fallback.</div>
    <header class="section-header"><h1>Alerts</h1></header>
    <section class="operation-group">
      <div class="section-header compact"><h2>Safety alerts</h2></div>
      <article class="panel alert-card" v-for="item in safetyAlerts" :key="item.id">
        <div class="card-topline"><strong>{{ item.message }}</strong><StatusBadge :label="item.severity ?? 'MEDIUM'" tone="warn" /></div>
        <p class="subtle">Field {{ item.fieldId ?? '-' }}</p>
      </article>
    </section>
    <section class="operation-group">
      <div class="section-header compact"><h2>Irrigation anomalies</h2></div>
      <article class="panel alert-card" v-for="item in anomalies" :key="item.id">
        <div class="card-topline"><strong>{{ item.message }}</strong><StatusBadge :label="item.type ?? 'ANOMALY'" tone="warn" /></div>
        <p class="subtle">Pressure, flow, pump, tank and valve checks are backend generated.</p>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAlerts } from '../api/mobile-api';
import { defaultFarmId, mockAlerts } from '../api/mock-data';
import StatusBadge from '../components/common/StatusBadge.vue';

const alerts = ref<any>(mockAlerts);
const isMock = ref(true);
const safetyAlerts = computed(() => (Array.isArray(alerts.value) ? alerts.value : alerts.value.safetyAlerts ?? []));
const anomalies = computed(() => (Array.isArray(alerts.value) ? [] : alerts.value.anomalies ?? []));

onMounted(async () => {
  const result = await getAlerts(defaultFarmId);
  alerts.value = result.data;
  isMock.value = result.isMock;
});
</script>
