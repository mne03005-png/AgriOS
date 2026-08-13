<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前为模拟地块数据</div>
    <header class="section-header">
      <div>
        <h1>{{ detail.field?.name ?? '田块详情' }}</h1>
        <p class="subtle">{{ detail.cropType ?? '--' }} · {{ detail.field?.areaMu ?? '-' }} 亩</p>
      </div>
    </header>

    <nav class="segmented field-tabs">
      <button v-for="tab in visibleTabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }}</button>
    </nav>

    <!-- 概况: default overview, answers the agricultural questions at a glance -->
    <template v-if="activeTab === '概况'">
      <section class="panel">
        <div class="panel-title">概况</div>
        <div class="metric-grid tight">
          <div class="metric-card"><span>作物</span><strong>{{ detail.cropType ?? '--' }}</strong></div>
          <div class="metric-card"><span>面积</span><strong>{{ detail.field?.areaMu ?? '-' }} 亩</strong></div>
          <div class="metric-card"><span>墒情</span><strong>{{ moistureLabel }}</strong></div>
          <div class="metric-card"><span>灌溉</span><strong>{{ irrigationStatusLabel }}</strong></div>
        </div>
        <p v-if="fieldAlerts.length" class="subtle">{{ fieldAlerts.length }} 条告警，请查看"告警"分栏</p>
        <p v-else class="subtle">暂无该田块的告警</p>
      </section>
      <DecisionExplanationCard v-if="detail.aiRecommendation" :item="detail.aiRecommendation" />
    </template>

    <!-- 墒情: current value, qualitative label only when a real recipe range exists, trend
         only when the API actually returned trend points (real backend returns none today) -->
    <template v-if="activeTab === '墒情'">
      <section class="panel">
        <div class="panel-title">墒情</div>
        <p>当前墒情 <strong>{{ detail.latestMoisture?.value ?? '--' }}</strong> <span v-if="moistureQualitative" class="subtle">（{{ moistureQualitative }}）</span></p>
        <p v-if="moistureFreshness" class="subtle">{{ moistureFreshness }}</p>
        <p v-if="detail.moistureTrend?.length" class="subtle">趋势：{{ detail.moistureTrend.join(' / ') }}</p>
      </section>
    </template>

    <!-- 灌溉: status + recent record; ValveControlPanel stays here, unconnected -->
    <template v-if="activeTab === '灌溉'">
      <section class="panel">
        <div class="panel-title">灌溉</div>
        <p>当前状态 <strong>{{ irrigationStatusLabel }}</strong></p>
        <p v-if="recommendationLabel">建议 <strong>{{ recommendationLabel }}</strong></p>
        <p v-if="latestIrrigation">最近记录 {{ translateStatusLabel(latestIrrigation.status) }}<span v-if="latestIrrigation.waterAmount"> · 用水 {{ latestIrrigation.waterAmount }}</span></p>
        <p v-else class="subtle">暂无灌溉记录</p>
      </section>
      <ValveControlPanel @command="onValve" />
    </template>

    <!-- 作物: only fields the API actually returns (cropType, growth stage, health observations) -->
    <template v-if="activeTab === '作物'">
      <section class="panel">
        <div class="panel-title">作物</div>
        <p>作物 <strong>{{ detail.cropType ?? '--' }}</strong></p>
        <p>生长状态 <strong>{{ detail.cropStage ?? '--' }}</strong></p>
      </section>
      <section class="panel">
        <div class="panel-title">健康观察</div>
        <p v-for="item in detail.cropHealthObservations ?? []" :key="item.id" class="list-line">
          {{ item.title }} <StatusBadge :label="item.severity ?? 'UNKNOWN'" tone="warn" />
        </p>
        <p v-if="!(detail.cropHealthObservations ?? []).length" class="subtle">暂无观察记录</p>
      </section>
    </template>

    <!-- 设备: only farmer-relevant device state, no MQTT/PLC/Modbus internals -->
    <template v-if="activeTab === '设备'">
      <section class="panel">
        <div class="panel-title">阀门</div>
        <p v-for="item in detail.valveStatus ?? []" :key="item.id" class="list-line">
          {{ item.name ?? item.id }} <span class="subtle">{{ typeof item.online === 'boolean' ? (item.online ? '在线' : '离线') : '状态未知' }}</span>
        </p>
        <p v-if="!(detail.valveStatus ?? []).length" class="subtle">暂无阀门</p>
      </section>
      <section class="panel">
        <div class="panel-title">传感器</div>
        <p v-for="item in detail.sensorStatus ?? []" :key="item.id" class="list-line">
          {{ item.name ?? item.id }} <span class="subtle">{{ typeof item.online === 'boolean' ? (item.online ? '在线' : '离线') : '状态未知' }}</span>
        </p>
        <p v-if="!(detail.sensorStatus ?? []).length" class="subtle">暂无传感器</p>
      </section>
    </template>

    <!-- 告警: field-scoped alerts, filtered client-side from the existing farm-scoped
         getAlerts() response -- no new filtering API -->
    <template v-if="activeTab === '告警'">
      <section class="panel">
        <div class="panel-title">告警</div>
        <div v-for="item in fieldAlerts" :key="item.id" class="list-line">
          <span class="attention-row-main"><strong>{{ item.message ?? '告警' }}</strong><StatusBadge :label="item.severity ?? 'MEDIUM'" tone="warn" /></span>
          <span class="subtle">{{ translateStatusLabel(item.status ?? 'OPEN') }}</span>
        </div>
        <p v-if="!fieldAlerts.length" class="subtle">暂无该田块的告警</p>
        <RouterLink class="ghost-button link-button" to="/alerts">查看全部告警</RouterLink>
      </section>
    </template>

    <!-- 记录: existing operation reports + drone operation records -->
    <template v-if="activeTab === '记录'">
      <section class="panel">
        <div class="panel-title">最新作业报告</div>
        <RouterLink v-for="item in detail.latestOperationReports ?? []" :key="item.id" class="list-line link-line" :to="`/operation-reports/${item.id}`">
          {{ item.title }}
        </RouterLink>
        <p v-if="!(detail.latestOperationReports ?? []).length" class="subtle">暂无报告</p>
      </section>
      <section class="panel">
        <div class="panel-title">无人机作业记录</div>
        <p v-for="item in detail.droneOperationRecords ?? []" :key="item.id" class="list-line">
          {{ translateStatusLabel(item.operationType) }} · {{ percent(item.coverageRate) }}
        </p>
        <p v-if="!(detail.droneOperationRecords ?? []).length" class="subtle">暂无无人机作业记录</p>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { controlValve, getAlerts, getFieldDetail } from '../api/mobile-api';
import { getFarmById } from '../api/farm-api';
import { defaultFieldId, mockFieldDetail } from '../api/mock-data';
import DecisionExplanationCard from '../components/ai/DecisionExplanationCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import ValveControlPanel from '../components/control/ValveControlPanel.vue';
import { apiErrorMessage } from '../api/api-error';
import { translateStatusLabel } from '../services/status-translation';
import { formatFreshness } from '../services/home-summary';
import { authStore } from '../stores/auth.store';
import { farmStore } from '../stores/farm.store';

const route = useRoute();
const router = useRouter();
const detail = ref<any>(mockFieldDetail);
const isMock = ref(true);
const fieldAlerts = ref<any[]>([]);
// The farm this currently-displayed field actually belongs to (from the field API's own
// response), used to tell "this field's own farm correction" apart from an unrelated,
// incompatible farm change elsewhere -- see the farmStore.currentFarmId watcher below.
const fieldFarmId = ref<string | null>(null);

const tabs = [
  { key: '概况', label: '概况' },
  { key: '墒情', label: '墒情' },
  { key: '灌溉', label: '灌溉' },
  { key: '作物', label: '作物' },
  { key: '设备', label: '设备' },
  { key: '告警', label: '告警' },
  { key: '记录', label: '记录' }
] as const;
type TabKey = (typeof tabs)[number]['key'];
const activeTab = ref<TabKey>('概况');
// Every tab here is backed by real existing FieldDetail/alerts data (see UX-1D field-detail
// data mapping); none are hidden today, but the structure stays in case a future gap appears.
const visibleTabs = tabs;

async function loadField(rawFieldId: unknown) {
  const fieldId = String(rawFieldId ?? defaultFieldId);
  const result = await getFieldDetail(fieldId);
  // Race guard: if the user has already navigated to a different field by the time this
  // resolves, a slower response for the OLD field must not overwrite the new one.
  if (fieldId !== String(route.params.fieldId ?? defaultFieldId)) return;
  detail.value = result.data;
  isMock.value = result.isMock;

  const realFieldFarmId: string | undefined = result.data?.field?.farmId;
  if (realFieldFarmId) {
    fieldFarmId.value = realFieldFarmId;
    // Resource context (the field's real farm ownership) overrides whatever farm was
    // previously current, including a stale persisted farm cache.
    if (realFieldFarmId !== farmStore.currentFarmId) {
      const knownName = realFieldFarmId === authStore.user?.farmId ? authStore.user?.farm?.name ?? null : null;
      if (knownName) {
        farmStore.setCurrentFarm(realFieldFarmId, knownName);
      } else {
        farmStore.setCurrentFarm(realFieldFarmId, null);
        const farmResult = await getFarmById(realFieldFarmId);
        if (fieldId === String(route.params.fieldId ?? defaultFieldId)) farmStore.setCurrentFarm(realFieldFarmId, farmResult.data?.name ?? null);
      }
    }
  }

  const alertsFarmId = realFieldFarmId ?? farmStore.currentFarmIdOrDefault;
  const alertsResult = await getAlerts(alertsFarmId);
  if (fieldId !== String(route.params.fieldId ?? defaultFieldId)) return;
  const allAlerts = [...(alertsResult.data?.safetyAlerts ?? []), ...(alertsResult.data?.anomalies ?? [])];
  fieldAlerts.value = allAlerts.filter((item: any) => item.fieldId === fieldId);
}

// route.params.fieldId changes without remounting this component (Vue Router reuses the
// instance across param-only navigations on the same matched route), so a plain onMounted
// would silently keep showing the previous field -- watch the param instead.
watch(() => route.params.fieldId, loadField, { immediate: true });

// Farm-switch-clears-incompatible-field (UX-1D section 10): only reacts when farmStore changes
// to something OTHER than this field's own farm (a genuinely incompatible external change);
// the field's own correction above always sets fieldFarmId to match first, so it never
// self-triggers this redirect.
watch(
  () => farmStore.currentFarmId,
  (newFarmId) => {
    if (fieldFarmId.value && newFarmId && newFarmId !== fieldFarmId.value) {
      router.replace('/map');
    }
  }
);

async function onValve(command: 'VALVE_OPEN' | 'VALVE_CLOSE') {
  const response = await controlValve({ deviceId: 'valve_001', command, remark: 'field detail manual valve' });
  if (response.status === 'ERROR' || response.status === 'OFFLINE') window.alert(apiErrorMessage({ errorCode: response.errorCode ?? 'INTERNAL_ERROR', message: response.errorMessage ?? '操作失败，请稍后重试。', requestId: response.requestId }));
  else window.alert('阀门请求已提交。');
}

function percent(value?: number) {
  if (!Number.isFinite(Number(value))) return '--';
  const number = Number(value);
  return `${(number > 1 ? number : number * 100).toFixed(1)}%`;
}

const moistureQualitative = computed(() => {
  const value = Number(detail.value.latestMoisture?.value);
  const min = detail.value.cropIrrigationRecipe?.targetMoistureMin;
  const max = detail.value.cropIrrigationRecipe?.targetMoistureMax;
  if (!Number.isFinite(value) || typeof min !== 'number' || typeof max !== 'number') return null;
  if (value < min) return '偏低';
  if (value > max) return '偏高';
  return '正常';
});
const moistureLabel = computed(() => detail.value.latestMoisture?.value ?? '--');
const moistureFreshness = computed(() => formatFreshness(detail.value.latestMoisture?.reportedAt ?? null));
const latestIrrigation = computed(() => (detail.value.irrigationHistory ?? [])[0] ?? null);
const irrigationStatusLabel = computed(() => (latestIrrigation.value ? translateStatusLabel(latestIrrigation.value.status ?? 'UNKNOWN') : '暂无记录'));
const recommendationLabel = computed(() => detail.value.aiRecommendation?.recommendation ?? null);
</script>
