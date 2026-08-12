<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为模拟数据。</div>
    <header class="section-header">
      <div>
        <p class="eyebrow">Manager</p>
        <h1>{{ data.farm?.name ?? '管理概览' }}</h1>
        <p class="subtle">农场运营状态、待处理审核和作业入口。</p>
      </div>
    </header>

    <!-- 农场状态: overall operational state -->
    <section class="panel status-panel">
      <div class="panel-title">农场状态</div>
      <div class="status-row">
        <span class="risk-badge" :class="riskTone">{{ translateStatusLabel(data.todayRiskLevel ?? 'NORMAL') }}</span>
        <span class="subtle">{{ fieldCounts.ok }} 个田块正常 / {{ fieldCounts.attention }} 个需要关注</span>
      </div>
      <p v-if="freshnessLabel" class="subtle freshness">{{ freshnessLabel }}</p>
    </section>

    <!-- 待处理: pending reviews/approvals, from existing review/boundary endpoints -->
    <section class="panel">
      <div class="panel-title">待处理</div>
      <RouterLink class="list-line link-line" to="/drone-reviews">无人机审核 {{ pendingDroneReviews }}</RouterLink>
      <RouterLink class="list-line link-line" to="/boundaries/review">边界审核 {{ pendingBoundaryReviews }}</RouterLink>
    </section>

    <!-- 进行中的作业 -->
    <section v-if="activeOperations.length" class="panel">
      <div class="panel-title">进行中的作业</div>
      <div v-for="op in activeOperations" :key="op.key" class="list-line">
        <span class="attention-row-main">
          <strong>{{ op.label }}</strong>
          <StatusBadge :label="op.status" tone="ok" />
        </span>
        <span v-if="op.detail" class="subtle">{{ op.detail }}</span>
      </div>
    </section>

    <!-- 重点告警 -->
    <section class="panel">
      <div class="panel-title">重点告警</div>
      <RouterLink v-if="(data.pendingAlerts ?? 0) > 0" class="link-line attention-link" to="/alerts">{{ data.pendingAlerts }} 个问题需要关注</RouterLink>
      <p v-else class="subtle">暂无待处理告警</p>
    </section>

    <!-- 快速入口 -->
    <section class="panel">
      <div class="panel-title">快速入口</div>
      <div class="workspace-grid">
        <RouterLink class="panel" to="/operations">作业与审批</RouterLink>
        <RouterLink class="panel" to="/reports">报表</RouterLink>
        <RouterLink class="panel" to="/drone-reviews">无人机审核</RouterLink>
        <RouterLink class="panel" to="/boundaries/review">边界审核</RouterLink>
      </div>
      <p class="subtle quick-actions-label">成员与 Zone 管理：功能建设中，尚未开放</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { getAlerts, getCockpit } from '../api/mobile-api';
import { getDroneReviews } from '../api/drone-review-api';
import { getFieldBoundaries } from '../api/gis-api';
import { defaultFarmId, mockCockpit, mockAlerts } from '../api/mock-data';
import { translateStatusLabel } from '../services/status-translation';
import { countFieldsOk, deriveFieldAttention, formatFreshness } from '../services/home-summary';

const data = ref<any>(mockCockpit);
const alerts = ref<any>(mockAlerts);
const isMock = ref(true);
const lastUpdatedAt = ref<string | null>(null);
const pendingDroneReviews = ref(0);
const pendingBoundaryReviews = ref(0);

onMounted(async () => {
  const [cockpitResult, alertsResult, droneReviewsResult, boundariesResult] = await Promise.allSettled([
    getCockpit(defaultFarmId),
    getAlerts(defaultFarmId),
    getDroneReviews(defaultFarmId, 'PENDING'),
    getFieldBoundaries(defaultFarmId, 'CANDIDATE')
  ]);
  if (cockpitResult.status === 'fulfilled') {
    data.value = cockpitResult.value.data;
    isMock.value = cockpitResult.value.isMock;
    lastUpdatedAt.value = cockpitResult.value.lastUpdatedAt;
  }
  // Each secondary section fails independently -- a broken alerts/review/boundary endpoint
  // must not take down the rest of the Manager Home.
  if (alertsResult.status === 'fulfilled') alerts.value = alertsResult.value.data;
  if (droneReviewsResult.status === 'fulfilled') pendingDroneReviews.value = (droneReviewsResult.value.data ?? []).length;
  if (boundariesResult.status === 'fulfilled') pendingBoundaryReviews.value = (boundariesResult.value.data ?? []).length;
});

const riskTone = computed(() => String(data.value.todayRiskLevel ?? 'NORMAL').toLowerCase());
const freshnessLabel = computed(() => formatFreshness(lastUpdatedAt.value));
const fieldCounts = computed(() => countFieldsOk(data.value.farm?.fields, deriveFieldAttention(data.value.farm?.fields, alerts.value)));
const activeOperations = computed(() => {
  const rotation = (data.value.activeRotationRuns ?? []).map((run: any) => ({ key: `rotation-${run.id}`, label: '轮灌', status: run.status ?? 'UNKNOWN', detail: null as string | null }));
  const fertigation = (data.value.fertigationStatus ?? []).map((task: any) => ({
    key: `fert-${task.id}`,
    label: '水肥',
    status: task.status ?? 'UNKNOWN',
    detail: task.durationMinutes ? `预计时长 ${task.durationMinutes} 分钟` : null
  }));
  const drone = (data.value.droneOperations ?? [])
    .filter((item: any) => item.status && !['REVIEWED', 'ARCHIVED', 'LINKED'].includes(item.status))
    .map((item: any) => ({ key: `drone-${item.id}`, label: '无人机作业', status: item.status ?? 'UNKNOWN', detail: null as string | null }));
  return [...rotation, ...fertigation, ...drone];
});
</script>
