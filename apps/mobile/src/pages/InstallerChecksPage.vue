<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Installer</p>
        <h1>设备安装验收</h1>
        <p class="subtle">ThingsBoard 用于现场安装调试，AgriOS 用于农业业务驾驶舱。</p>
      </div>
    </header>

    <div v-if="isMock" class="mock-banner">当前为 Demo fallback。真实验收数据来自 /api/v1/installer/device-checks。</div>
    <section v-if="!items.length" class="panel">
      <div class="panel-title">暂无验收记录</div>
      <p class="subtle">请由安装人员在后台创建设备安装验收记录。</p>
    </section>
    <section v-for="item in items" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.deviceCode }}</strong>
        <span class="status-pill">{{ item.status }}</span>
      </div>
      <p class="subtle">{{ item.deviceType }} · fieldId={{ item.fieldId ?? '-' }}</p>
      <div class="metric-grid compact">
        <div>Telemetry: {{ item.telemetryOk ? 'OK' : 'CHECK' }}</div>
        <div>Signal: {{ item.signalOk ? 'OK' : 'CHECK' }}</div>
        <div>Battery: {{ item.batteryOk ? 'OK' : 'CHECK' }}</div>
        <div>Binding: {{ item.bindingOk ? 'OK' : 'CHECK' }}</div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import { getInstallerChecks } from '../api/production-api';

const items = ref<any[]>([]);
const isMock = ref(false);

onMounted(async () => {
  const result = await getInstallerChecks();
  items.value = Array.isArray(result.data) ? result.data : [];
  isMock.value = result.isMock;
});
</script>
