<template>
  <section class="page">
    <div v-if="hasFallback" class="mock-banner">
      Demo fallback：部分生产接口暂时使用演示数据。已登录时会优先调用真实 API；若接口返回 401/403 或其他错误，请查看下方接口错误。
    </div>

    <header class="section-header">
      <div>
        <p class="eyebrow">P13 Device Integration</p>
        <h1>真实设备接入调试</h1>
        <p class="subtle">只展示调试摘要，不暴露 token，不直接控制真实水泵、阀门或无人机。</p>
      </div>
      <span class="status-pill">{{ ready.deviceControlMode ?? 'MOCK' }}</span>
    </header>

    <section class="metric-grid tight showcase-metrics">
      <div class="metric-card">
        <span>控制模式</span>
        <strong>{{ ready.deviceControlMode ?? 'MOCK' }}</strong>
      </div>
      <div class="metric-card">
        <span>ThingsBoard</span>
        <strong>{{ thingsBoardStatusText }}</strong>
      </div>
      <div class="metric-card">
        <span>Edge</span>
        <strong>{{ ready.edgeControllerConfigured ? '已配置' : '模拟/未配置' }}</strong>
      </div>
      <div class="metric-card">
        <span>Bluetooth</span>
        <strong>{{ ready.bluetoothLocalEnabled ? '启用' : '关闭' }}</strong>
      </div>
      <div class="metric-card">
        <span>AI 建议</span>
        <strong>{{ listCount(recommendations) }}</strong>
      </div>
      <div class="metric-card">
        <span>ActionQueue</span>
        <strong>{{ listCount(actionJobs) }}</strong>
      </div>
      <div class="metric-card">
        <span>Edge 命令</span>
        <strong>{{ listCount(edgeCommands) }}</strong>
      </div>
      <div class="metric-card">
        <span>审计事件</span>
        <strong>{{ listCount(auditEvents) }}</strong>
      </div>
    </section>

    <section v-if="apiErrors.length" class="panel">
      <div class="panel-title">API Errors</div>
      <div v-for="item in apiErrors" :key="item" class="list-line warning-text">{{ item }}</div>
    </section>

    <section class="panel">
      <div class="panel-title">Telemetry Snapshot</div>
      <div class="status-grid">
        <div class="status-row"><span>压力</span><strong>{{ formatTelemetry(telemetry.pressureSummary, 'avgKpa', 'kPa') }}</strong></div>
        <div class="status-row"><span>流量</span><strong>{{ formatTelemetry(telemetry.flowSummary, 'avgM3h', 'm3/h') }}</strong></div>
        <div class="status-row"><span>水泵状态</span><strong>{{ telemetry.pumpStatus?.length ?? 0 }}</strong></div>
        <div class="status-row"><span>阀门状态</span><strong>{{ telemetry.valveStatus?.length ?? 0 }}</strong></div>
        <div class="status-row"><span>液位预警</span><strong :class="(telemetry.tankLevelWarnings?.length ?? 0) ? 'warning-text' : 'ok-text'">{{ telemetry.tankLevelWarnings?.length ?? 0 }}</strong></div>
      </div>
    </section>

    <section class="panel real-sensor-panel">
      <div class="panel-title">Real Sensor Telemetry</div>
      <div class="status-grid">
        <div class="status-row"><span>Data source</span><strong>{{ realSensorSourceText }}</strong></div>
        <div class="status-row"><span>Latest SensorRecord</span><strong>{{ latestSensorRecordLabel }}</strong></div>
        <div class="status-row"><span>DeviceTelemetrySnapshot</span><strong>{{ latestSnapshotLabel }}</strong></div>
        <div class="status-row"><span>Binding status</span><strong>{{ bindingStatusLabel }}</strong></div>
        <div class="status-row"><span>ThingsBoard device id</span><strong>{{ realSensorDeviceId }}</strong></div>
        <div class="status-row"><span>ThingsBoard device name</span><strong>{{ realSensorDeviceName }}</strong></div>
      </div>
      <div class="telemetry-preview">
        <span>Normalized telemetry preview</span>
        <pre>{{ normalizedTelemetryPreview }}</pre>
      </div>
      <p class="subtle">Current stage only validates telemetry ingestion. No pump, valve, or other hardware control action is executed here.</p>
    </section>

    <section class="panel">
      <div class="panel-title">Production Readiness</div>
      <div class="status-grid">
        <div class="status-row"><span>DeviceControl ready</span><strong :class="ready.deviceControlModeReady ? 'ok-text' : 'warning-text'">{{ ready.deviceControlModeReady ? 'READY' : 'CHECK' }}</strong></div>
        <div class="status-row"><span>Auto execution</span><strong>{{ ready.enableAutoExecution ? 'ON' : 'OFF' }}</strong></div>
        <div class="status-row"><span>Safe default</span><strong :class="ready.safeDefault ? 'ok-text' : 'warning-text'">{{ ready.safeDefault ? 'ON' : 'OFF' }}</strong></div>
        <div class="status-row"><span>MQTT direct</span><strong>{{ ready.mqttDirectConfigured ? 'CONFIGURED' : 'OPTIONAL' }}</strong></div>
        <div class="status-row"><span>PLC gateway</span><strong>{{ ready.plcGatewayConfigured ? 'CONFIGURED' : 'OPTIONAL' }}</strong></div>
      </div>
      <p v-for="warning in ready.productionWarnings ?? []" :key="warning" class="warning-text">{{ warning }}</p>
    </section>

    <section class="panel">
      <div class="panel-title">Latest AI Recommendations</div>
      <p v-if="!listItems(recommendations).length" class="subtle">暂无 AI 建议。可运行 P13 smoke test 或调用 farm analyze 生成建议。</p>
      <div v-for="item in listItems(recommendations).slice(0, 3)" :key="item.id ?? item.title" class="list-line">
        <strong>{{ item.title ?? item.recommendation ?? item.type ?? 'Recommendation' }}</strong>
        <span class="subtle">{{ item.severity ?? item.status ?? 'INFO' }}</span>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">Action / Edge / Audit</div>
      <div class="status-grid">
        <div class="status-row"><span>队列任务</span><strong>{{ describeFirst(actionJobs) }}</strong></div>
        <div class="status-row"><span>Edge 命令</span><strong>{{ describeFirst(edgeCommands) }}</strong></div>
        <div class="status-row"><span>最新审计</span><strong>{{ describeFirst(auditEvents) }}</strong></div>
      </div>
      <p class="subtle">真实执行仍必须通过 Safety / Approval / ActionQueue / DeviceControl，本页面不提供直接开泵或开阀按钮。</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { defaultFarmId } from '../api/mock-data';
import {
  getAIRecommendationList,
  getActionQueueJobs,
  getAuditEvents,
  getEdgeCommands,
  getFarmTelemetrySummary,
  getHealthReady,
  getLatestRealSensorTelemetry,
  getBindingCandidatesForThingsBoard
} from '../api/production-api';

const ready = ref<any>({});
const telemetry = ref<any>({});
const recommendations = ref<any>([]);
const actionJobs = ref<any>([]);
const edgeCommands = ref<any>([]);
const auditEvents = ref<any>([]);
const realSensorTelemetry = ref<any>({});
const bindingCandidates = ref<any>({});
const fallbackFlags = ref<boolean[]>([]);
const apiErrors = ref<string[]>([]);

const hasFallback = computed(() => fallbackFlags.value.some(Boolean));
const thingsBoardStatusText = computed(() => {
  if (ready.value.thingsBoardConfigured) return 'ThingsBoard Cloud 已配置';
  return `ThingsBoard Cloud 未配置，当前使用 ${ready.value.deviceControlMode ?? 'MQTT_DIRECT'}`;
});

onMounted(async () => {
  const results = await Promise.all([
    getHealthReady(),
    getFarmTelemetrySummary(defaultFarmId),
    getAIRecommendationList(defaultFarmId),
    getActionQueueJobs(defaultFarmId),
    getEdgeCommands(defaultFarmId),
    getAuditEvents(defaultFarmId),
    getLatestRealSensorTelemetry(defaultFarmId),
    getBindingCandidatesForThingsBoard()
  ]);
  ready.value = results[0].data;
  telemetry.value = results[1].data;
  recommendations.value = results[2].data;
  actionJobs.value = results[3].data;
  edgeCommands.value = results[4].data;
  auditEvents.value = results[5].data;
  realSensorTelemetry.value = results[6].data;
  bindingCandidates.value = results[7].data;
  fallbackFlags.value = results.map((item) => item.isMock);
  apiErrors.value = results
    .filter((item) => item.isMock && item.error)
    // Authorization failures are carried separately from the normalized data state.
    .map((item) => `${item.path ?? 'API'}: ${item.error}${item.status === 401 || item.status === 403 ? '。请登录具备权限的账号。' : ''}`);
});

const latestSensorRecord = computed(() => realSensorTelemetry.value?.sensorRecord ?? null);
const latestSnapshot = computed(() => realSensorTelemetry.value?.snapshot ?? null);
const realSensorSourceText = computed(() => (fallbackFlags.value[6] ? 'Demo fallback' : 'Production API'));
const normalizedTelemetry = computed(() => latestSensorRecord.value?.normalizedJson ?? latestSnapshot.value?.normalizedJson ?? {});
const latestSensorRecordLabel = computed(() => formatLatestTelemetry(latestSensorRecord.value));
const latestSnapshotLabel = computed(() => formatLatestTelemetry(latestSnapshot.value));
const realSensorDeviceId = computed(() => latestSensorRecord.value?.thingsboardDeviceId ?? latestSnapshot.value?.thingsboardDeviceId ?? bindingCandidates.value?.thingsboardDeviceId ?? '--');
const realSensorDeviceName = computed(() => latestSensorRecord.value?.deviceName ?? bindingCandidates.value?.deviceName ?? '--');
const bindingStatusLabel = computed(() => {
  const first = listItems(bindingCandidates.value?.candidates ?? bindingCandidates.value)[0];
  if (!first) return latestSensorRecord.value?.deviceId ? 'LINKED' : 'UNBOUND';
  return `${first.confidence ?? 'UNKNOWN'} ${first.fieldId ? 'FIELD' : first.deviceId ? 'DEVICE' : 'CANDIDATE'}`;
});
const normalizedTelemetryPreview = computed(() => JSON.stringify(normalizedTelemetry.value, null, 2));

function listItems(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function listCount(value: any) {
  return listItems(value).length;
}

function describeFirst(value: any) {
  const first = listItems(value)[0];
  if (!first) return '暂无';
  return first.status ?? first.eventType ?? first.command ?? first.id ?? '有记录';
}

function formatTelemetry(value: any, key: string, unit: string) {
  const numberValue = Number(value?.[key] ?? value?.latest?.[key]);
  if (!Number.isFinite(numberValue)) return '--';
  return `${numberValue.toFixed(1)} ${unit}`;
}

function formatLatestTelemetry(value: any) {
  if (!value) return '--';
  const reportedAt = value.reportedAt ? new Date(value.reportedAt).toLocaleString() : 'latest';
  const soilMoisture = Number(value.soilMoisture ?? value.normalizedJson?.soilMoisture);
  if (Number.isFinite(soilMoisture)) return `${soilMoisture.toFixed(1)}% @ ${reportedAt}`;
  return reportedAt;
}
</script>
