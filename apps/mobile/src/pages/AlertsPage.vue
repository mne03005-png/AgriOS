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
        <p class="subtle">压力、流量、水泵、水箱和阀门检查均由后端生成。</p>
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
