<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为模拟数据。</div>
    <header class="section-header">
      <h1>作业</h1>
      <ExecutionModeSwitch mode="ASSISTED" />
    </header>

    <nav class="segmented field-tabs">
      <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTabKey === tab.key }" @click="selectTab(tab.key)">{{ tab.label }}</button>
    </nav>

    <!-- 当前作业: existing action-plan/rotation/fertigation/drone groups, unchanged content -->
    <template v-if="activeTabKey === 'all'">
      <section v-if="!hasOperations || !demoReady" class="panel">
        <div class="panel-title">作业数据尚未就绪</div>
        <p class="warning-text">请先执行 npx prisma db seed，生成轮灌、水肥、无人机等 Demo 作业。</p>
        <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
      </section>
      <section v-for="group in groups" :key="group.key" class="operation-group">
        <div class="section-header compact">
          <h2>{{ group.title }}</h2>
          <span class="subtle">{{ group.items.length }} 条记录</span>
        </div>
        <article v-for="item in group.items" :key="item.id" class="panel">
          <div class="card-topline">
            <strong>{{ item.name ?? item.id ?? item.decision?.recommendation ?? '作业' }}</strong>
            <StatusBadge :label="item.status ?? 'UNKNOWN'" tone="muted" />
          </div>
          <p class="subtle">{{ item.operationType ?? item.command ?? item.type ?? '后端控制作业' }}</p>
        </article>
      </section>
    </template>

    <!-- 农事记录: UX-1E consolidation target for the old /farm-records stub -- same honest
         "under construction" message, no fabricated records -->
    <template v-if="activeTabKey === 'records'">
      <section class="panel empty-state">
        <strong>功能建设中</strong>
        <p>农事记录将在 Phase B 交付。本页面不展示模拟记录。</p>
      </section>
    </template>

    <!-- 无人机: discovery card into the existing /drone-operations page, not a duplicate of it -->
    <template v-if="activeTabKey === 'drone'">
      <section class="panel">
        <div class="panel-title">无人机作业</div>
        <p class="subtle">测绘、喷洒、撒播与巡田作业记录。</p>
        <RouterLink class="primary-button" to="/drone-operations">查看无人机作业</RouterLink>
      </section>
    </template>

    <!-- 审核: MANAGER-only discovery into existing review queues -- no new approval logic -->
    <template v-if="activeTabKey === 'approvals'">
      <section class="panel">
        <div class="panel-title">待审核事项</div>
        <RouterLink class="list-line link-line" to="/drone-reviews">无人机作业审核</RouterLink>
        <RouterLink class="list-line link-line" to="/boundaries/review">边界审核</RouterLink>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getDemoHealth } from '../api/demo-api';
import { getOperations } from '../api/mobile-api';
import { mockOperations } from '../api/mock-data';
import StatusBadge from '../components/common/StatusBadge.vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import ExecutionModeSwitch from '../components/control/ExecutionModeSwitch.vue';
import { canAccess, canonicalRole } from '../services/permissions';
import { authStore } from '../stores/auth.store';
import { farmStore } from '../stores/farm.store';

const route = useRoute();
const router = useRouter();

const operations = ref<any>(mockOperations);
const isMock = ref(true);
const demoReady = ref(true);

const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));

// Only role-appropriate tabs are ever offered -- 无人机 mirrors /drone-operations' own route
// meta (MANAGER/ENGINEER/SUPER_ADMIN), 审核 mirrors the discovery already on Manager Home
// (MANAGER/SUPER_ADMIN). FARMER never sees either, matching existing route authorization
// exactly (no widening).
const tabs = computed(() => {
  const list = [
    { key: 'all', label: '当前作业' },
    { key: 'records', label: '农事记录' }
  ];
  if (canAccess(['MANAGER', 'ENGINEER', 'SUPER_ADMIN'], role.value)) list.push({ key: 'drone', label: '无人机' });
  if (canAccess(['MANAGER', 'SUPER_ADMIN'], role.value)) list.push({ key: 'approvals', label: '审核' });
  return list;
});

// The URL query is the single source of truth for the active tab: reload/back/forward all
// work for free, and an unknown or unauthorized tab value safely falls back to 当前作业
// instead of crashing or silently granting a tab the current role can't see.
const activeTabKey = computed(() => {
  const requested = typeof route.query.tab === 'string' ? route.query.tab : 'all';
  return tabs.value.some((tab) => tab.key === requested) ? requested : 'all';
});

function selectTab(key: string) {
  router.replace({ path: '/operations', query: key === 'all' ? {} : { tab: key } });
}

const groups = computed(() => [
  { key: 'actionPlans', title: '执行计划', items: asList(operations.value.actionPlans) },
  { key: 'rotationRuns', title: '轮灌', items: asList(operations.value.rotationRuns) },
  { key: 'fertigationTasks', title: '水肥', items: asList(operations.value.fertigationTasks) },
  { key: 'dissolveTasks', title: '肥料溶解', items: asList(operations.value.dissolveTasks ?? operations.value.dissolveFertilizerTasks) },
  { key: 'pumpOperations', title: '水泵作业', items: asList(operations.value.pumpOperations) },
  { key: 'droneMappingOperations', title: '无人机测绘', items: asList(operations.value.droneMappingOperations) },
  { key: 'droneSprayingOperations', title: '无人机喷洒', items: asList(operations.value.droneSprayingOperations) },
  { key: 'droneSpreadingOperations', title: '无人机撒播', items: asList(operations.value.droneSpreadingOperations) },
  { key: 'droneScoutingOperations', title: '无人机巡田', items: asList(operations.value.droneScoutingOperations) }
]);
const hasOperations = computed(() => groups.value.some((group) => group.items.length > 0));

// Lazy per-tab loading (UX-1E section 29/30): 当前作业 is the only tab backed by a real API
// call; 农事记录/无人机/审核 are static discovery content with zero network cost, so there is
// no multi-request page and no secondary-tab failure to isolate.
let loadedAllTab = false;
async function loadAllTab() {
  if (loadedAllTab) return;
  loadedAllTab = true;
  const requestedFarmId = farmStore.currentFarmIdOrDefault;
  const [result, health] = await Promise.all([getOperations(requestedFarmId), getDemoHealth(requestedFarmId)]);
  if (requestedFarmId !== farmStore.currentFarmIdOrDefault) { loadedAllTab = false; return; }
  operations.value = Array.isArray(result.data) ? { actionPlans: result.data } : result.data;
  isMock.value = result.isMock;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
}

watch(activeTabKey, (key) => { if (key === 'all') loadAllTab(); }, { immediate: true });
// Preserve UX-1D current-farm context: if the farm changes while 当前作业 is the visible tab,
// refresh it; a later visit to 当前作业 after a farm change also gets fresh data.
watch(() => farmStore.currentFarmIdOrDefault, () => {
  loadedAllTab = false;
  if (activeTabKey.value === 'all') loadAllTab();
});

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}
</script>
