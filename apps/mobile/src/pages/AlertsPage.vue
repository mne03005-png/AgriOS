<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前为模拟数据。</div>
    <header class="section-header"><h1>告警</h1></header>
    <section class="operation-group">
      <div class="section-header compact"><h2>安全告警</h2></div>
      <article class="panel alert-card" v-for="item in safetyAlerts" :key="item.id">
        <div class="card-topline"><strong>{{ item.message }}</strong><StatusBadge :label="item.severity ?? 'MEDIUM'" tone="warn" /></div>
        <p class="subtle">田块 {{ item.fieldId ?? '-' }}</p>
      </article>
    </section>
    <section class="operation-group">
      <div class="section-header compact"><h2>灌溉异常</h2></div>
      <article class="panel alert-card" v-for="item in anomalies" :key="item.id">
        <div class="card-topline"><strong>{{ item.message }}</strong><StatusBadge :label="item.type ?? 'ANOMALY'" tone="warn" /></div>
        <p class="subtle">系统根据压力、流量、水泵、水箱和阀门数据自动生成。</p>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getAlerts } from '../api/mobile-api';
import { mockAlerts } from '../api/mock-data';
import StatusBadge from '../components/common/StatusBadge.vue';
import { farmStore } from '../stores/farm.store';

const alerts = ref<any>(mockAlerts);
const isMock = ref(true);
const safetyAlerts = computed(() => (Array.isArray(alerts.value) ? alerts.value : alerts.value.safetyAlerts ?? []));
const anomalies = computed(() => (Array.isArray(alerts.value) ? [] : alerts.value.anomalies ?? []));

async function load() {
  // UX-1E: 告警 is now canonical primary navigation, so it must respect the shared UX-1D
  // current farm (not the old hardcoded default), with the same race guard used elsewhere.
  const requestedFarmId = farmStore.currentFarmIdOrDefault;
  const result = await getAlerts(requestedFarmId);
  if (requestedFarmId !== farmStore.currentFarmIdOrDefault) return;
  alerts.value = result.data;
  isMock.value = result.isMock;
}

onMounted(load);
watch(() => farmStore.currentFarmIdOrDefault, load);
</script>
