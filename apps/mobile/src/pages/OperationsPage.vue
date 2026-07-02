<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">Current operations are mock fallback.</div>
    <header class="section-header">
      <h1>Operations</h1>
      <ExecutionModeSwitch mode="ASSISTED" />
    </header>
    <section v-if="!hasOperations || !demoReady" class="panel">
      <div class="panel-title">Operations data not ready</div>
      <p class="warning-text">请先执行 npx prisma db seed，生成轮灌、水肥、无人机等 Demo 作业。</p>
      <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
    </section>
    <section v-for="group in groups" :key="group.key" class="operation-group">
      <div class="section-header compact">
        <h2>{{ group.title }}</h2>
        <span class="subtle">{{ group.items.length }} records</span>
      </div>
      <article v-for="item in group.items" :key="item.id" class="panel">
        <div class="card-topline">
          <strong>{{ item.name ?? item.id ?? item.decision?.recommendation ?? 'Operation' }}</strong>
          <StatusBadge :label="item.status ?? 'UNKNOWN'" tone="muted" />
        </div>
        <p class="subtle">{{ item.operationType ?? item.command ?? item.type ?? 'backend controlled operation' }}</p>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getDemoHealth } from '../api/demo-api';
import { getOperations } from '../api/mobile-api';
import { defaultFarmId, mockOperations } from '../api/mock-data';
import StatusBadge from '../components/common/StatusBadge.vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import ExecutionModeSwitch from '../components/control/ExecutionModeSwitch.vue';

const operations = ref<any>(mockOperations);
const isMock = ref(true);
const demoReady = ref(true);

const groups = computed(() => [
  { key: 'actionPlans', title: 'Action plans', items: asList(operations.value.actionPlans) },
  { key: 'rotationRuns', title: 'Rotation runs', items: asList(operations.value.rotationRuns) },
  { key: 'fertigationTasks', title: 'Fertigation tasks', items: asList(operations.value.fertigationTasks) },
  { key: 'dissolveTasks', title: 'Dissolve fertilizer tasks', items: asList(operations.value.dissolveTasks ?? operations.value.dissolveFertilizerTasks) },
  { key: 'pumpOperations', title: 'Pump operations', items: asList(operations.value.pumpOperations) },
  { key: 'droneMappingOperations', title: 'Drone mapping', items: asList(operations.value.droneMappingOperations) },
  { key: 'droneSprayingOperations', title: 'Drone spraying', items: asList(operations.value.droneSprayingOperations) },
  { key: 'droneSpreadingOperations', title: 'Drone spreading', items: asList(operations.value.droneSpreadingOperations) },
  { key: 'droneScoutingOperations', title: 'Drone scouting', items: asList(operations.value.droneScoutingOperations) }
]);
const hasOperations = computed(() => groups.value.some((group) => group.items.length > 0));

onMounted(async () => {
  const [result, health] = await Promise.all([getOperations(defaultFarmId), getDemoHealth(defaultFarmId)]);
  operations.value = Array.isArray(result.data) ? { actionPlans: result.data } : result.data;
  isMock.value = result.isMock;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
});

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}
</script>
