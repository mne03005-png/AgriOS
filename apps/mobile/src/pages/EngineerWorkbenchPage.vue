<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Engineer</p>
        <h1>工程师工作台</h1>
        <p class="subtle">围绕“这台设备 / 阀门 / 指令为什么没有生效”组织诊断链路。所有测试仍受后端 Safety、权限和审计控制。</p>
      </div>
    </header>

    <!-- 顶层分组: 设备诊断 / 维护工具 / 辅助工具 -->
    <div class="segmented field-tabs">
      <button v-for="group in groups" :key="group.key" :class="{ active: activeGroup === group.key }" type="button" @click="activeGroup = group.key">{{ group.label }}</button>
    </div>

    <!-- ============ 设备诊断: 身份 -> 连接 -> 遥测 -> 安全/联锁 -> 指令/队列 -> 反馈/结果 ============ -->
    <template v-if="activeGroup === 'diagnostics'">
      <section class="panel">
        <div class="panel-title">正在诊断的设备</div>
        <p v-if="devicesLoading" class="subtle">正在读取设备列表…</p>
        <p v-else-if="devicesError" class="warning-text">{{ devicesError }}</p>
        <p v-else-if="!devices.length" class="empty-state">暂无设备数据</p>
        <template v-else>
          <p class="subtle">{{ onlineCount }} / {{ devices.length }} 台在线 · 点击选择一台设备开始诊断</p>
          <button
            v-for="device in devices"
            :key="device.id"
            class="device-row"
            type="button"
            :class="{ active: selectedDevice?.id === device.id }"
            @click="selectDevice(device)"
          >
            <span>
              <strong>{{ device.name ?? device.code ?? device.id }}</strong>
              <small>{{ device.type ?? 'DEVICE' }} · {{ connectivityLabel(device) }}</small>
            </span>
            <StatusBadge :label="connectivityCode(device)" raw :tone="connectivityTone(device)" />
          </button>
        </template>
        <RouterLink class="link-line" to="/devices">完整设备遥测列表 →</RouterLink>
      </section>

      <div class="segmented field-tabs">
        <button v-for="stage in stages" :key="stage.key" :class="{ active: activeStage === stage.key }" type="button" @click="activeStage = stage.key">{{ stage.label }}</button>
      </div>

      <!-- 身份 / 连接 -->
      <section v-if="activeStage === 'identity'" class="panel">
        <div class="panel-title">身份 / 连接</div>
        <div v-if="!selectedDevice" class="empty-state">请先在上方选择一台设备</div>
        <div v-else class="status-grid">
          <div class="status-row"><span>设备名称</span><strong>{{ selectedDevice.name ?? selectedDevice.code ?? selectedDevice.id }}</strong></div>
          <div class="status-row"><span>deviceId</span><strong>{{ selectedDevice.id }}</strong></div>
          <div class="status-row"><span>类型</span><strong>{{ selectedDevice.type ?? 'DEVICE' }}</strong></div>
          <div class="status-row"><span>连接状态</span><strong><StatusBadge :label="connectivityCode(selectedDevice)" raw :tone="connectivityTone(selectedDevice)" /></strong></div>
          <div class="status-row"><span>数据来源</span><strong>{{ selectedDevice.source ?? 'thingsboard' }}</strong></div>
          <div class="status-row"><span>最近上报</span><strong>{{ selectedDevice.lastTelemetryAt ?? selectedDevice.lastReportedAt ?? '暂无上报记录' }}</strong></div>
        </div>
      </section>

      <!-- 遥测 -->
      <section v-if="activeStage === 'telemetry'" class="panel">
        <div class="panel-title">遥测</div>
        <div v-if="!selectedDevice" class="empty-state">请先在上方选择一台设备</div>
        <template v-else>
          <div class="segmented">
            <button :class="{ active: historyRange === '24h' }" type="button" @click="loadHistory('24h')">24h</button>
            <button :class="{ active: historyRange === '7d' }" type="button" @click="loadHistory('7d')">7d</button>
          </div>
          <p v-if="historyLoading" class="subtle">正在读取遥测历史…</p>
          <p v-else-if="historyError" class="warning-text">{{ historyError }}</p>
          <p v-else-if="!history.length" class="empty-state">暂无遥测数据</p>
          <div v-else class="trend-list">
            <div v-for="item in history" :key="item.id" class="trend-row">
              <span>{{ item.reportedAt }}</span>
              <strong>{{ item.qualityStatus ?? 'GOOD' }} · {{ item.qualityScore ?? 100 }}</strong>
            </div>
          </div>
        </template>
        <div class="panel-title">农场遥测汇总</div>
        <p v-if="telemetryLoading" class="subtle">正在读取农场遥测汇总…</p>
        <p v-else-if="telemetryError" class="warning-text">{{ telemetryError }}</p>
        <div v-else class="status-grid">
          <div class="status-row"><span>压力</span><strong>{{ formatTelemetry(telemetry.pressureSummary, 'avgKpa', 'kPa') }}</strong></div>
          <div class="status-row"><span>流量</span><strong>{{ formatTelemetry(telemetry.flowSummary, 'avgM3h', 'm3/h') }}</strong></div>
          <div class="status-row"><span>水泵状态记录数</span><strong>{{ telemetry.pumpStatus?.length ?? 0 }}</strong></div>
          <div class="status-row"><span>阀门状态记录数</span><strong>{{ telemetry.valveStatus?.length ?? 0 }}</strong></div>
        </div>
      </section>

      <!-- 安全 / 联锁 -->
      <section v-if="activeStage === 'safety'" class="panel">
        <div class="panel-title">安全 / 联锁</div>
        <p class="subtle">当前设备暂无设备级安全 / 联锁反馈数据</p>

        <div class="panel-title">演示阀门安全测试（模拟，非当前选中设备，{{ demoValveId }}）</div>
        <p v-if="valveLoading" class="subtle">正在读取演示阀门安全测试状态…</p>
        <p v-else-if="valveError" class="warning-text">{{ valveError }}</p>
        <div v-else class="status-grid">
          <div class="status-row"><span>Dry-Run</span><strong>{{ valveStatus.dryRun === false ? 'OFF' : 'ON' }}</strong></div>
          <div class="status-row"><span>真实控制</span><strong>{{ valveStatus.realControlAllowed ? 'ALLOWED' : 'BLOCKED' }}</strong></div>
          <div class="status-row"><span>需要物理反馈</span><strong>{{ valveStatus.feedbackRequired === false ? 'OPTIONAL' : 'REQUIRED' }}</strong></div>
          <div class="status-row"><span>演示阀门状态</span><strong>{{ valveStatus.valveStatus ?? 'UNKNOWN' }}</strong></div>
        </div>

        <div class="panel-title">农场级联锁 / 环境条件（液位 / 泵 / 阀门告警，来自 farm telemetry summary）</div>
        <p v-if="telemetryLoading" class="subtle">正在读取农场遥测汇总…</p>
        <p v-else-if="telemetryError" class="warning-text">{{ telemetryError }}</p>
        <p v-else-if="!(telemetry.tankLevelWarnings?.length)" class="subtle">暂无液位预警</p>
        <p v-else class="warning-text">{{ telemetry.tankLevelWarnings.length }} 条液位预警</p>

        <div class="panel-title">审批诊断</div>
        <p class="subtle">当前无可用审批诊断数据</p>
      </section>

      <!-- 指令 / 队列 -->
      <section v-if="activeStage === 'command'" class="panel">
        <div class="panel-title">指令</div>
        <RouterLink class="link-line" to="/valve-control-test">阀门安全测试（模拟）→</RouterLink>
        <p class="subtle">真实指令发送仍必须经过 Safety / Approval / ActionQueue / DeviceControl，本页不提供直接下发按钮。</p>
        <div class="panel-title">队列（农场级，未按设备过滤）</div>
        <p v-if="queueLoading" class="subtle">正在读取队列摘要…</p>
        <p v-else-if="queueError" class="warning-text">{{ queueError }}</p>
        <p v-else-if="!queueJobs.length" class="subtle">暂无队列任务记录</p>
        <p v-else class="subtle">{{ queueJobs.length }} 条队列任务记录（来自 ActionQueue API，农场级汇总，非按当前设备过滤）</p>
        <p class="subtle">队列诊断（完整视图）：功能建设中</p>
        <RouterLink class="link-line" to="/action-queue">队列诊断页面 →</RouterLink>
      </section>

      <!-- 反馈 / 结果 -->
      <section v-if="activeStage === 'feedback'" class="panel">
        <div class="panel-title">反馈 / 结果</div>
        <p class="subtle">当前设备暂无设备级执行反馈数据</p>

        <div class="panel-title">演示阀门反馈（模拟测试，非当前选中设备，{{ demoValveId }}）</div>
        <p v-if="valveLoading" class="subtle">正在读取演示阀门反馈…</p>
        <p v-else-if="valveError" class="warning-text">{{ valveError }}</p>
        <template v-else>
          <div class="status-row"><span>结果</span><strong><StatusBadge :label="feedbackCode" raw :tone="feedbackTone" /></strong></div>
          <p class="subtle">{{ feedbackLabel }}</p>
          <div class="telemetry-preview">
            <span>工程详情</span>
            <pre>{{ feedbackDetailPreview }}</pre>
          </div>
        </template>
      </section>
    </template>

    <!-- ============ 维护工具 ============ -->
    <template v-if="activeGroup === 'maintenance'">
      <section class="panel">
        <div class="panel-title">维护工具</div>
        <div class="workspace-grid">
          <RouterLink class="panel" to="/bluetooth-maintenance"><strong>蓝牙维护</strong><span class="capability-state">近场调试 / 维护会话</span></RouterLink>
          <RouterLink class="panel" to="/valve-control-test"><strong>阀门安全测试（模拟）</strong><span class="capability-state">DRY_RUN ONLY</span></RouterLink>
          <RouterLink class="panel" to="/edge-gateways"><strong>网关 / PLC 深度诊断</strong><span class="capability-state">Edge / MQTT / PLC</span></RouterLink>
          <RouterLink class="panel" to="/device-integration"><strong>设备接入调试</strong><span class="capability-state">ThingsBoard / 集成快照</span></RouterLink>
          <RouterLink class="panel" to="/installer-checks"><strong>安装检查</strong><span class="capability-state">安装验收清单</span></RouterLink>
        </div>
      </section>
    </template>

    <!-- ============ 辅助工具 ============ -->
    <template v-if="activeGroup === 'utility'">
      <section class="panel">
        <div class="panel-title">辅助工具 / 环境</div>
        <p class="subtle">以下工具用于确认 Demo 环境和演示路径是否就绪，不代表真实设备健康状态。</p>
        <div class="workspace-grid">
          <RouterLink class="panel" to="/demo-status"><strong>环境状态</strong><span class="capability-state">DEVELOPMENT_ONLY</span></RouterLink>
          <RouterLink class="panel" to="/showcase"><strong>演示工具</strong><span class="capability-state">DEMO_TOOL</span></RouterLink>
        </div>
      </section>
    </template>

    <!-- 农场上下文: ENGINEER 仍可访问已授权的正常农场路由 (UX-1B 保持) -->
    <section class="panel">
      <div class="panel-title">农场上下文</div>
      <div class="button-row">
        <RouterLink class="secondary-button" to="/cockpit">首页</RouterLink>
        <RouterLink class="secondary-button" to="/map">田块</RouterLink>
        <RouterLink class="secondary-button" to="/operations">作业</RouterLink>
        <RouterLink class="secondary-button" to="/alerts">告警</RouterLink>
        <RouterLink class="secondary-button" to="/reports">数据</RouterLink>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { getReadOnlyDeviceHistory, getReadOnlyDevices } from '../api/mobile-api';
import { getActionQueueJobs, getFarmTelemetrySummary, getValveControlStatus } from '../api/production-api';
import { farmStore } from '../stores/farm.store';

const demoValveId = 'demo-valve-001';

const groups = [
  { key: 'diagnostics', label: '设备诊断' },
  { key: 'maintenance', label: '维护工具' },
  { key: 'utility', label: '辅助工具' }
] as const;
const stages = [
  { key: 'identity', label: '身份 / 连接' },
  { key: 'telemetry', label: '遥测' },
  { key: 'safety', label: '安全 / 联锁' },
  { key: 'command', label: '指令 / 队列' },
  { key: 'feedback', label: '反馈 / 结果' }
] as const;
const activeGroup = ref<'diagnostics' | 'maintenance' | 'utility'>('diagnostics');
const activeStage = ref<'identity' | 'telemetry' | 'safety' | 'command' | 'feedback'>('identity');

// --- 身份 / 连接: device list ---
const devices = ref<any[]>([]);
const devicesLoading = ref(true);
const devicesError = ref('');
const selectedDevice = ref<any | null>(null);
const onlineCount = computed(() => devices.value.filter((device) => device.online).length);

function connectivityCode(device: any) {
  if (device.online === true) return 'CONNECTED';
  if (device.online === false) return 'DISCONNECTED';
  return 'UNKNOWN';
}
function connectivityLabel(device: any) {
  const code = connectivityCode(device);
  return code === 'CONNECTED' ? '已连接' : code === 'DISCONNECTED' ? '离线' : '状态未知';
}
function connectivityTone(device: any): 'ok' | 'warn' | 'muted' {
  const code = connectivityCode(device);
  return code === 'CONNECTED' ? 'ok' : code === 'DISCONNECTED' ? 'warn' : 'muted';
}

function selectDevice(device: any) {
  selectedDevice.value = device;
  history.value = [];
  loadHistory(historyRange.value);
}

// --- 遥测: per-device history + farm-wide summary ---
const history = ref<any[]>([]);
const historyLoading = ref(false);
const historyError = ref('');
const historyRange = ref<'24h' | '7d'>('24h');
async function loadHistory(range: '24h' | '7d') {
  historyRange.value = range;
  if (!selectedDevice.value?.id) return;
  historyLoading.value = true;
  historyError.value = '';
  try {
    const result = await getReadOnlyDeviceHistory(selectedDevice.value.id, range);
    history.value = result.data.items ?? [];
  } catch {
    historyError.value = '遥测历史读取失败';
  } finally {
    historyLoading.value = false;
  }
}

const telemetry = ref<any>({});
const telemetryLoading = ref(true);
const telemetryError = ref('');
function formatTelemetry(value: any, key: string, unit: string) {
  const numberValue = Number(value?.[key] ?? value?.latest?.[key]);
  if (!Number.isFinite(numberValue)) return '--';
  return `${numberValue.toFixed(1)} ${unit}`;
}

// --- 安全/联锁 + 反馈/结果: demo valve status ---
const valveStatus = ref<any>({});
const valveLoading = ref(true);
const valveError = ref('');
const feedbackCode = computed(() => {
  if (!valveStatus.value.latestCommand) return 'NO_COMMAND';
  if (!valveStatus.value.latestExecution) return 'FEEDBACK_PENDING';
  const execution = valveStatus.value.latestExecution;
  if (execution.outcome === 'UNKNOWN') return 'OUTCOME_UNKNOWN';
  if (execution.expectedState && execution.observedState && execution.expectedState !== execution.observedState) return 'FEEDBACK_MISMATCH';
  return execution.success === false ? 'FAILED' : 'CONFIRMED';
});
const feedbackTone = computed<'ok' | 'warn' | 'danger' | 'muted'>(() => {
  const code = feedbackCode.value;
  if (code === 'CONFIRMED') return 'ok';
  if (code === 'NO_COMMAND') return 'muted';
  if (code === 'FEEDBACK_PENDING') return 'warn';
  return 'danger';
});
const feedbackLabel = computed(() => {
  const map: Record<string, string> = {
    NO_COMMAND: '暂无指令记录',
    FEEDBACK_PENDING: '设备反馈：等待设备反馈',
    OUTCOME_UNKNOWN: '设备反馈：结果未知，需要人工核实',
    FEEDBACK_MISMATCH: '设备反馈：物理反馈与预期不一致',
    FAILED: '设备反馈：执行失败',
    CONFIRMED: '设备反馈：已确认'
  };
  return map[feedbackCode.value] ?? '暂无指令记录';
});
const feedbackDetailPreview = computed(() =>
  JSON.stringify({ commandId: valveStatus.value.latestCommand?.commandId ?? valveStatus.value.latestCommand?.id ?? null, requestId: valveStatus.value.latestCommand?.requestId ?? null, latestExecution: valveStatus.value.latestExecution ?? null }, null, 2)
);

// --- 指令/队列: honest queue summary ---
const queueJobs = ref<any[]>([]);
const queueLoading = ref(true);
const queueError = ref('');

async function loadDiagnostics() {
  devicesLoading.value = true;
  devicesError.value = '';
  telemetryLoading.value = true;
  telemetryError.value = '';
  valveLoading.value = true;
  valveError.value = '';
  queueLoading.value = true;
  queueError.value = '';
  const requestedFarmId = farmStore.currentFarmIdOrDefault;
  const [devicesResult, telemetryResult, valveResult, queueResult] = await Promise.allSettled([
    getReadOnlyDevices(),
    getFarmTelemetrySummary(requestedFarmId),
    getValveControlStatus(demoValveId),
    getActionQueueJobs(requestedFarmId)
  ]);
  // Each diagnostic stage fails independently -- one broken integration must not take down
  // the rest of the Engineer landing (UX-1F section 25).
  if (devicesResult.status === 'fulfilled') {
    devices.value = devicesResult.value.data.items ?? [];
    if (!selectedDevice.value && devices.value[0]) selectDevice(devices.value[0]);
  } else {
    devicesError.value = '设备列表读取失败';
  }
  devicesLoading.value = false;

  if (requestedFarmId === farmStore.currentFarmIdOrDefault) {
    if (telemetryResult.status === 'fulfilled') telemetry.value = telemetryResult.value.data;
    else telemetryError.value = '农场遥测汇总读取失败';
    telemetryLoading.value = false;

    if (queueResult.status === 'fulfilled') queueJobs.value = Array.isArray(queueResult.value.data) ? queueResult.value.data : [];
    else queueError.value = '队列摘要读取失败';
    queueLoading.value = false;
  }

  if (valveResult.status === 'fulfilled') valveStatus.value = valveResult.value.data;
  else valveError.value = '安全 / 联锁状态读取失败';
  valveLoading.value = false;
}

onMounted(loadDiagnostics);
watch(() => farmStore.currentFarmIdOrDefault, loadDiagnostics);
</script>
