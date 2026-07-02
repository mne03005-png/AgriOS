<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">Current drone data is mock fallback.</div>
    <header class="section-header">
      <h1>Drone Operations</h1>
      <p class="subtle">Mapping, spraying, spreading and scouting records.</p>
    </header>
    <section class="button-row">
      <RouterLink class="primary-button" to="/drone-reviews">Review Queue</RouterLink>
      <RouterLink class="secondary-button" to="/reports">Reports</RouterLink>
    </section>
    <section v-if="!operations.length || !demoReady" class="panel">
      <div class="panel-title">Drone demo data not ready</div>
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
  { type: 'MAPPING', label: 'Mapping operations', items: byType('MAPPING') },
  { type: 'SPRAYING', label: 'Spraying operations', items: byType('SPRAYING') },
  { type: 'SPREADING', label: 'Spreading operations', items: byType('SPREADING') },
  { type: 'SCOUTING', label: 'Scouting operations', items: byType('SCOUTING') }
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
