<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为模拟数据。连接 backend 后会自动切换真实 Demo 数据。</div>
    <FarmStatusHeader :farm="data.farm" :weather="data.weather" :online-rate="data.deviceOnlineRate ?? 0" />

    <!-- 今日状态: highest priority -- is the farm generally okay, is anything urgent -->
    <section class="panel status-panel">
      <div class="panel-title">今日状态</div>
      <div class="status-row">
        <span class="risk-badge" :class="riskTone">{{ translateStatusLabel(data.todayRiskLevel ?? 'NORMAL') }}</span>
        <RouterLink v-if="(data.pendingAlerts ?? 0) > 0" class="link-line attention-link" to="/alerts">{{ data.pendingAlerts }} 个问题需要关注</RouterLink>
        <span v-else class="subtle">暂无待处理告警</span>
      </div>
      <p v-if="freshnessLabel" class="subtle freshness">{{ freshnessLabel }}</p>
    </section>

    <!-- 田块: which field needs attention first -->
    <section class="panel">
      <div class="panel-title">田块</div>
      <template v-if="fieldAttention.length">
        <RouterLink v-for="item in fieldAttention" :key="item.fieldId" class="list-line link-line attention-row" :to="`/fields/${item.fieldId}`">
          <span class="attention-row-main">
            <strong>{{ item.fieldName }}</strong>
            <StatusBadge :label="item.severity" tone="warn" />
          </span>
          <span class="subtle">需要关注</span>
        </RouterLink>
      </template>
      <p v-else class="subtle">暂无田块需要重点关注</p>
      <RouterLink class="ghost-button link-button" to="/map">查看全部田块</RouterLink>
    </section>

    <!-- 正在进行: is irrigation/another operation currently running -->
    <section v-if="activeOperations.length" class="panel">
      <div class="panel-title">正在进行</div>
      <div v-for="op in activeOperations" :key="op.key" class="list-line">
        <span class="attention-row-main">
          <strong>{{ op.label }}</strong>
          <StatusBadge :label="op.status" tone="ok" />
        </span>
        <span v-if="op.detail" class="subtle">{{ op.detail }}</span>
      </div>
    </section>

    <!-- 建议: at most one recommendation, advisory-only -->
    <AIRecommendationCard :decision="data.latestDecision" :plans="data.latestActionPlans ?? []" />

    <!-- 异常设备: only when operationally relevant -->
    <section v-if="hasDeviceIssues" class="panel">
      <div class="panel-title">设备</div>
      <p v-if="(data.deviceOnlineRate ?? 100) < 100" class="subtle">设备在线率 {{ data.deviceOnlineRate }}%，部分设备离线</p>
      <p v-if="(data.tankLevelWarnings?.length ?? 0) > 0" class="subtle">{{ data.tankLevelWarnings.length }} 个设备水箱液位偏低</p>
    </section>

    <!-- secondary content: recent activity + mini map, lower priority, 2-column on desktop -->
    <div class="dashboard-grid secondary-grid">
      <FarmActivityTimeline :activities="(data.latestActivities ?? []).slice(0, 4)" />
      <MiniFarmMap :layers="data.miniMapLayers ?? []" :risk-level="data.todayRiskLevel" />
    </div>

    <section v-if="!demoReady" class="panel">
      <div class="panel-title">Demo data not ready</div>
      <p class="warning-text">请先在 apps/backend 执行 npx prisma db seed，然后刷新 Cockpit。</p>
      <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
    </section>

    <!-- demoted: unavailable physical controls, visually secondary and clearly inert -->
    <p class="subtle quick-actions-label">其他操作（暂未开放）</p>
    <QuickActions />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getAlerts, getCockpit } from '../api/mobile-api';
import { getDemoHealth } from '../api/demo-api';
import { mockCockpit, mockAlerts } from '../api/mock-data';
import DemoHeader from '../components/common/DemoHeader.vue';
import FarmStatusHeader from '../components/cockpit/FarmStatusHeader.vue';
import FarmActivityTimeline from '../components/cockpit/FarmActivityTimeline.vue';
import MiniFarmMap from '../components/cockpit/MiniFarmMap.vue';
import AIRecommendationCard from '../components/cockpit/AIRecommendationCard.vue';
import QuickActions from '../components/cockpit/QuickActions.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { translateStatusLabel } from '../services/status-translation';
import { deriveFieldAttention, formatFreshness } from '../services/home-summary';
import { farmStore } from '../stores/farm.store';

const data = ref<any>(mockCockpit);
const alerts = ref<any>(mockAlerts);
const isMock = ref(true);
const demoReady = ref(true);
const lastUpdatedAt = ref<string | null>(null);

async function load() {
  // Race guard: if the user's current farm changes again before this request settles, the
  // slower/older response must not overwrite the newer farm's data (UX-1D section 31).
  const requestedFarmId = farmStore.currentFarmIdOrDefault;
  const [result, alertsResult, health] = await Promise.all([getCockpit(requestedFarmId), getAlerts(requestedFarmId), getDemoHealth(requestedFarmId)]);
  if (requestedFarmId !== farmStore.currentFarmIdOrDefault) return;
  data.value = result.data;
  alerts.value = alertsResult.data;
  isMock.value = result.isMock;
  lastUpdatedAt.value = result.lastUpdatedAt;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
}

onMounted(load);
// Farmer Home must reflect the shared CURRENT FARM, not just whatever farm it happened to
// load first with (UX-1D sections 24/25).
watch(() => farmStore.currentFarmIdOrDefault, load);

const riskTone = computed(() => String(data.value.todayRiskLevel ?? 'NORMAL').toLowerCase());
const freshnessLabel = computed(() => formatFreshness(lastUpdatedAt.value));
const fieldAttention = computed(() => deriveFieldAttention(data.value.farm?.fields, alerts.value));
const hasDeviceIssues = computed(() => (data.value.deviceOnlineRate ?? 100) < 100 || (data.value.tankLevelWarnings?.length ?? 0) > 0);
const activeOperations = computed(() => {
  const rotation = (data.value.activeRotationRuns ?? []).map((run: any) => ({ key: `rotation-${run.id}`, label: '轮灌', status: run.status ?? 'UNKNOWN', detail: null as string | null }));
  const fertigation = (data.value.fertigationStatus ?? []).map((task: any) => ({
    key: `fert-${task.id}`,
    label: '水肥',
    status: task.status ?? 'UNKNOWN',
    detail: task.durationMinutes ? `预计时长 ${task.durationMinutes} 分钟` : null
  }));
  return [...rotation, ...fertigation];
});
</script>
