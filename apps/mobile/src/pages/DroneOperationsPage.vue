<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为模拟数据。</div>
    <header class="section-header">
      <h1>无人机作业</h1>
      <p class="subtle">测绘、喷洒、撒播与巡田记录。</p>
    </header>
    <section class="button-row">
      <RouterLink class="primary-button" to="/drone-reviews">审核队列</RouterLink>
      <RouterLink class="secondary-button" to="/reports">报表</RouterLink>
    </section>
    <section v-if="!operations.length || !demoReady" class="panel">
      <div class="panel-title">无人机 Demo 数据尚未就绪</div>
      <p class="warning-text">请先执行 npx prisma db seed，生成 Demo 无人机作业、审核和报告。</p>
      <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
    </section>
    <DroneCoverageSummary :operations="operations" />
    <DroneImportPanel @imported="load" />
    <section v-for="group in groups" :key="group.type" class="operation-group">
      <div class="section-header compact">
        <h2>{{ group.label }}</h2>
        <span class="subtle">{{ group.items.length }} records</span>
      </div>
      <DroneOperationCard v-for="item in group.items" :key="item.id" :item="item" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getDemoHealth } from '../api/demo-api';
import { getDroneOperations } from '../api/drone-api';
import { defaultFarmId, mockDroneOperations } from '../api/mock-data';
import DroneCoverageSummary from '../components/drone/DroneCoverageSummary.vue';
import DroneImportPanel from '../components/drone/DroneImportPanel.vue';
import DroneOperationCard from '../components/drone/DroneOperationCard.vue';
import DemoHeader from '../components/common/DemoHeader.vue';

const operations = ref<any[]>(mockDroneOperations);
const isMock = ref(true);
const demoReady = ref(true);

const groups = computed(() => [
  { type: 'MAPPING', label: '测绘作业', items: byType('MAPPING') },
  { type: 'SPRAYING', label: '喷洒作业', items: byType('SPRAYING') },
  { type: 'SPREADING', label: '撒播作业', items: byType('SPREADING') },
  { type: 'SCOUTING', label: '巡田作业', items: byType('SCOUTING') }
]);

onMounted(load);

async function load() {
  const [result, health] = await Promise.all([getDroneOperations(defaultFarmId), getDemoHealth(defaultFarmId)]);
  operations.value = Array.isArray(result.data) ? result.data : [];
  isMock.value = result.isMock;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
}

function byType(type: string) {
  return operations.value.filter((item) => item.operationType === type);
}
</script>
