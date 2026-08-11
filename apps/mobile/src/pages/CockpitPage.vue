<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为模拟数据。连接 backend 后会自动切换真实 Demo 数据。</div>
    <FarmStatusHeader :farm="data.farm" :weather="data.weather" :online-rate="data.deviceOnlineRate ?? 0" />

    <section class="panel">
      <div class="panel-title">农场驾驶舱总览</div>
      <p class="subtle">把风险、设备、灌溉、水肥、无人机和农事动态集中到一个移动中控屏。</p>
      <div class="metric-grid tight showcase-metrics">
        <div class="metric-card"><span>今日风险</span><strong>{{ data.todayRiskLevel ?? 'NORMAL' }}</strong></div>
        <div class="metric-card"><span>设备在线率</span><strong>{{ data.deviceOnlineRate ?? 0 }}%</strong></div>
        <div class="metric-card"><span>今日用水</span><strong>{{ data.todayWaterUsage ?? 0 }}</strong></div>
        <div class="metric-card"><span>无人机作业</span><strong>{{ data.droneOperations?.length ?? 0 }}</strong></div>
        <div class="metric-card"><span>轮灌状态</span><strong>{{ data.activeRotationRuns?.length ?? 0 }}</strong></div>
        <div class="metric-card"><span>水肥状态</span><strong>{{ data.fertigationStatus?.length ?? 0 }}</strong></div>
        <div class="metric-card"><span>农事动态</span><strong>{{ data.latestActivities?.length ?? 0 }}</strong></div>
      </div>
    </section>

    <RiskCards :data="data" />
    <PressureFlowSummaryCard :pressure-summary="data.pressureSummary" :flow-summary="data.flowSummary" />
    <PumpStatusCard :pump-status="data.pumpStatus ?? []" />
    <FertigationStatusCard :fertigation-status="data.fertigationStatus ?? []" :tank-level-warnings="data.tankLevelWarnings ?? []" />
    <MiniFarmMap :layers="data.miniMapLayers ?? []" :risk-level="data.todayRiskLevel" />
    <FarmActivityTimeline :activities="data.latestActivities ?? []" />
    <AIRecommendationCard :decision="data.latestDecision" :plans="data.latestActionPlans ?? []" />
    <QuickActions />
    <section v-if="!demoReady" class="panel">
      <div class="panel-title">Demo data not ready</div>
      <p class="warning-text">请先在 apps/backend 执行 npx prisma db seed，然后刷新 Cockpit。</p>
      <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { controlValve, emergencyStop, getCockpit } from '../api/mobile-api';
import { getDemoHealth } from '../api/demo-api';
import { defaultFarmId, mockCockpit } from '../api/mock-data';
import DemoHeader from '../components/common/DemoHeader.vue';
import FarmStatusHeader from '../components/cockpit/FarmStatusHeader.vue';
import FarmActivityTimeline from '../components/cockpit/FarmActivityTimeline.vue';
import FertigationStatusCard from '../components/cockpit/FertigationStatusCard.vue';
import RiskCards from '../components/cockpit/RiskCards.vue';
import MiniFarmMap from '../components/cockpit/MiniFarmMap.vue';
import AIRecommendationCard from '../components/cockpit/AIRecommendationCard.vue';
import PressureFlowSummaryCard from '../components/cockpit/PressureFlowSummaryCard.vue';
import PumpStatusCard from '../components/cockpit/PumpStatusCard.vue';
import QuickActions from '../components/cockpit/QuickActions.vue';
import { apiErrorMessage } from '../api/api-error';

const data = ref<any>(mockCockpit);
const isMock = ref(true);
const demoReady = ref(true);

onMounted(async () => {
  const [result, health] = await Promise.all([getCockpit(defaultFarmId), getDemoHealth(defaultFarmId)]);
  data.value = result.data;
  isMock.value = result.isMock;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
});

async function onEmergencyStop() {
  const response = await emergencyStop(defaultFarmId);
  const result = response.data as any;
  if (response.status === 'ERROR' || response.status === 'OFFLINE') window.alert(apiErrorMessage({ errorCode: response.errorCode ?? 'INTERNAL_ERROR', message: response.errorMessage ?? '操作失败，请稍后重试。', requestId: response.requestId }));
  else if (result?.state === 'LATCHED' && result?.dispatch === 'DISPATCHED') window.alert(`Emergency Stop latched; command dispatched to ${result.targetCount} target(s). Physical stop is not yet confirmed.`);
  else if (result?.state === 'ALREADY_LATCHED') window.alert('System is already in Emergency Stop state.');
  else if (result?.state === 'LATCHED') window.alert(`Emergency Stop latched, but dispatch status is ${result.dispatch}. Equipment must be checked.`);
  else window.alert('Emergency Stop result could not be confirmed.');
}

async function onValve() {
  const response = await controlValve({ deviceId: 'valve_001', command: 'VALVE_OPEN', remark: 'mobile cockpit manual valve' });
  if (response.status === 'ERROR' || response.status === 'OFFLINE') window.alert(apiErrorMessage({ errorCode: response.errorCode ?? 'INTERNAL_ERROR', message: response.errorMessage ?? '操作失败，请稍后重试。', requestId: response.requestId }));
  else window.alert('开阀请求已提交。');
}
</script>
