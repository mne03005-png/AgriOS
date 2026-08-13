<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">Demo health is mock fallback. 请先启动 backend 并执行 npx prisma db seed。</div>
    <header class="section-header compact">
      <div>
        <p class="eyebrow">Demo Status</p>
        <h2>{{ health.isReady ? 'Demo Ready' : 'Demo Not Ready' }}</h2>
        <p class="subtle">farmId={{ health.farmId ?? defaultFarmId }}</p>
      </div>
      <span class="status-pill">{{ health.isReady ? 'READY' : 'CHECK' }}</span>
    </header>

    <section class="panel">
      <div class="panel-title">Production Mode</div>
      <div class="status-grid">
        <div class="status-row"><span>controlMode</span><strong>{{ ready.deviceControlMode ?? 'MOCK' }}</strong></div>
        <div class="status-row"><span>deviceControlReady</span><strong :class="ready.deviceControlModeReady ? 'ok-text' : 'warning-text'">{{ ready.deviceControlModeReady ? 'READY' : 'CHECK' }}</strong></div>
        <div class="status-row"><span>thingsBoard</span><strong>{{ ready.thingsBoardConfigured ? 'CONFIGURED' : 'INSTALLER ONLY' }}</strong></div>
        <div class="status-row"><span>edge</span><strong>{{ ready.edgeControllerConfigured ? 'CONFIGURED' : 'SKELETON' }}</strong></div>
        <div class="status-row"><span>bluetooth</span><strong>{{ ready.bluetoothLocalEnabled ? 'ENABLED' : 'DISABLED' }}</strong></div>
      </div>
      <p class="subtle">ThingsBoard 用于设备调试，AgriOS 用于农场生产管理。</p>
    </section>

    <section class="panel">
      <div class="panel-title">Module Status</div>
      <div class="status-grid">
        <div v-for="(item, key) in health.moduleStatus ?? {}" :key="key" class="status-row">
          <span>{{ key }}</span>
          <strong :class="item.ready ? 'ok-text' : 'warning-text'">{{ item.ready ? 'READY' : 'MISSING' }} · {{ item.count ?? 0 }}</strong>
        </div>
      </div>
    </section>

    <section v-if="health.missingItems?.length" class="panel">
      <div class="panel-title">Missing Items</div>
      <p v-for="item in health.missingItems" :key="item" class="list-line">{{ item }}</p>
    </section>

    <section v-if="health.warnings?.length" class="panel">
      <div class="panel-title">Warnings</div>
      <p v-for="item in health.warnings" :key="item" class="warning-text">{{ item }}</p>
    </section>

    <section class="panel">
      <div class="panel-title">Recommended Actions</div>
      <p v-for="item in health.recommendedActions ?? []" :key="item" class="list-line">{{ item }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getDemoHealth } from '../api/demo-api';
import { getHealthReady } from '../api/production-api';
import { defaultFarmId } from '../api/mock-data';

const health = ref<any>({});
const ready = ref<any>({});
const isMock = ref(true);

onMounted(async () => {
  const result = await getDemoHealth(defaultFarmId);
  health.value = result.data;
  isMock.value = result.isMock;
  const readyResult = await getHealthReady();
  ready.value = readyResult.data;
});
</script>
