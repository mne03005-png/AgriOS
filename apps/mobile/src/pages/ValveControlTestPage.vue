<template>
  <section class="page">
    <DemoHeader />
    <div class="mock-banner">当前为安全模拟模式，不会真实打开阀门，不会启动水泵。</div>

    <header class="section-header">
      <div>
        <p class="eyebrow">P13.2 Valve Dry-Run</p>
        <h1>阀门安全测试</h1>
        <p class="subtle">默认只发送 dry-run 请求。真实阀门控制必须显式配置、审批，并经过 Safety / ActionQueue / DeviceControl。</p>
      </div>
      <span class="status-pill">{{ health.deviceControlMode ?? 'MOCK' }}</span>
    </header>

    <section class="metric-grid tight showcase-metrics">
      <div class="metric-card">
        <span>Dry-Run</span>
        <strong>{{ health.valveDryRun === false ? 'OFF' : 'ON' }}</strong>
      </div>
      <div class="metric-card">
        <span>Real Control</span>
        <strong>{{ health.valveRealControlAllowed ? 'ALLOWED' : 'BLOCKED' }}</strong>
      </div>
      <div class="metric-card">
        <span>Feedback</span>
        <strong>{{ health.valveFeedbackRequired === false ? 'OPTIONAL' : 'REQUIRED' }}</strong>
      </div>
      <div class="metric-card">
        <span>Timeout</span>
        <strong>{{ health.valveCommandTimeoutMs ?? 10000 }} ms</strong>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">Valve Device</div>
      <div class="status-grid">
        <div class="status-row"><span>Device</span><strong>{{ valve.deviceCode ?? valve.deviceId ?? 'demo-valve-001' }}</strong></div>
        <div class="status-row"><span>Online</span><strong>{{ valve.online ? 'ONLINE' : 'OFFLINE' }}</strong></div>
        <div class="status-row"><span>Status</span><strong>{{ valve.valveStatus ?? 'UNKNOWN' }}</strong></div>
        <div class="status-row"><span>Opening</span><strong>{{ valve.valveOpeningPercent ?? 0 }}%</strong></div>
        <div class="status-row"><span>Latest ACK</span><strong>{{ latestAck }}</strong></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">Dry-Run Controls</div>
      <div v-if="canExecute" class="button-grid">
        <button class="primary-button" type="button" @click="runTestOpen">测试开阀</button>
        <button class="secondary-button" type="button" @click="runClose">模拟关阀</button>
        <button class="secondary-button" type="button" @click="runSetOpening">设置模拟开度</button>
        <button class="secondary-button" type="button" @click="refresh">查询状态</button>
      </div>
      <p v-else class="warning-text">当前角色仅可查看，不能发起阀门测试请求。</p>
      <p class="subtle">按钮固定发送 dry-run 请求，不展示 ThingsBoard token，也不会绕过后端安全链路。</p>
    </section>

    <section class="panel">
      <div class="panel-title">Recent Command</div>
      <div class="status-grid">
        <div class="status-row"><span>CommandId</span><strong>{{ lastResult.commandId ?? latestCommand?.requestId ?? '--' }}</strong></div>
        <div class="status-row"><span>QueueJob</span><strong>{{ lastResult.queueJobId ?? '--' }}</strong></div>
        <div class="status-row"><span>Safety</span><strong>{{ lastResult.safety?.allowed === false ? 'BLOCKED' : 'PASS / DRY-RUN' }}</strong></div>
        <div class="status-row"><span>ACK</span><strong>{{ lastResult.ack?.status ?? latestCommand?.status ?? '--' }}</strong></div>
      </div>
      <div class="telemetry-preview">
        <span>Safety / ACK preview</span>
        <pre>{{ previewJson }}</pre>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import { authStore } from '../stores/auth.store';
import { requestDangerousConfirmation } from '../services/dangerous-operation';
import { apiErrorMessage } from '../api/api-error';
import {
  getHealthReady,
  getValveCommands,
  getValveControlStatus,
  postValveClose,
  postValveSetOpening,
  postValveTestOpen
} from '../api/production-api';

const demoValveId = 'demo-valve-001';
const health = ref<any>({});
const valve = ref<any>({});
const commands = ref<any[]>([]);
const lastResult = ref<any>({});

const canExecute = computed(() => {
  const role = authStore.user?.role;
  return role !== 'VIEWER';
});
const latestCommand = computed(() => commands.value[0] ?? valve.value.latestCommand ?? null);
const latestAck = computed(() => latestCommand.value?.ackAt ?? valve.value.latestExecution?.feedbackAt ?? '--');
const previewJson = computed(() => JSON.stringify(lastResult.value.commandId ? lastResult.value : latestCommand.value ?? {}, null, 2));

onMounted(refresh);

async function refresh() {
  const [healthResult, statusResult, commandsResult] = await Promise.all([
    getHealthReady(),
    getValveControlStatus(demoValveId),
    getValveCommands(demoValveId)
  ]);
  health.value = healthResult.data;
  valve.value = statusResult.data;
  const commandData: any = commandsResult.data;
  commands.value = Array.isArray(commandData) ? commandData : commandData?.items ?? [];
}

async function runTestOpen() {
  const confirmation = requestDangerousConfirmation('VALVE_OPEN', demoValveId, authStore.user?.farmId ?? '未选择', '未指定');
  if (!confirmation.ok) { lastResult.value = { status: 'BLOCKED', error: confirmation.error }; return; }
  const result = await postValveTestOpen(demoValveId, 3, confirmation.reason, confirmation.reauthToken);
  lastResult.value = result.status === 'ERROR' || result.status === 'OFFLINE' ? { status: 'BLOCKED', error: apiErrorMessage({ errorCode: result.errorCode ?? 'INTERNAL_ERROR', message: result.errorMessage ?? '操作失败，请稍后重试。', requestId: result.requestId }), errorCode: result.errorCode, requestId: result.requestId } : result.data;
  await refresh();
}

async function runClose() {
  const confirmation = requestDangerousConfirmation('VALVE_CLOSE', demoValveId, authStore.user?.farmId ?? '未选择', '未指定');
  if (!confirmation.ok) { lastResult.value = { status: 'BLOCKED', error: confirmation.error }; return; }
  const result = await postValveClose(demoValveId, confirmation.reason, confirmation.reauthToken);
  lastResult.value = result.status === 'ERROR' || result.status === 'OFFLINE' ? { status: 'BLOCKED', error: apiErrorMessage({ errorCode: result.errorCode ?? 'INTERNAL_ERROR', message: result.errorMessage ?? '操作失败，请稍后重试。', requestId: result.requestId }), errorCode: result.errorCode, requestId: result.requestId } : result.data;
  await refresh();
}

async function runSetOpening() {
  const confirmation = requestDangerousConfirmation('VALVE_OPEN', demoValveId, authStore.user?.farmId ?? '未选择', '未指定');
  if (!confirmation.ok) { lastResult.value = { status: 'BLOCKED', error: confirmation.error }; return; }
  const result = await postValveSetOpening(demoValveId, 5, confirmation.reason, confirmation.reauthToken);
  lastResult.value = result.status === 'ERROR' || result.status === 'OFFLINE' ? { status: 'BLOCKED', error: apiErrorMessage({ errorCode: result.errorCode ?? 'INTERNAL_ERROR', message: result.errorMessage ?? '操作失败，请稍后重试。', requestId: result.requestId }), errorCode: result.errorCode, requestId: result.requestId } : result.data;
  await refresh();
}
</script>
