<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Installer</p>
        <h1>设备安装验收</h1>
        <p class="subtle">按顺序检查这台设备在正式接入前需要完成的项目，而不是零散的技术页面。</p>
      </div>
    </header>

    <div v-if="isMock" class="mock-banner">当前为 Demo fallback。真实验收数据来自 /api/v1/installer/device-checks。</div>

    <!-- 分步骤总览: 一眼看清整体进度，而不是逐页翻找 -->
    <section class="panel">
      <div class="panel-title">调试步骤</div>
      <p class="subtle">{{ availableCount }} 项可用 · {{ partialCount }} 项部分可用 · {{ futureCount }} 项功能建设中</p>
      <button
        v-for="step in steps"
        :key="step.key"
        class="device-row"
        type="button"
        :class="{ active: activeStepKey === step.key }"
        @click="activeStepKey = step.key"
      >
        <span>
          <strong>{{ step.index }}. {{ step.label }}</strong>
          <small>{{ step.summary }}</small>
        </span>
        <StatusBadge :label="step.status" raw :tone="statusTone(step.status)" />
      </button>
    </section>

    <!-- 当前步骤详情 -->
    <section class="panel">
      <div class="panel-title">{{ activeStep.index }}. {{ activeStep.label }}</div>
      <StatusBadge :label="activeStep.status" raw :tone="statusTone(activeStep.status)" />
      <p class="subtle">{{ activeStep.description }}</p>

      <!-- 1: 项目 / 农场 -->
      <template v-if="activeStepKey === 'project'">
        <div class="status-grid">
          <div class="status-row"><span>当前农场</span><strong>{{ farmStore.currentFarmName ?? farmStore.currentFarmId ?? '暂无农场上下文' }}</strong></div>
        </div>
      </template>

      <!-- 2: 田块 -->
      <template v-if="activeStepKey === 'field'">
        <RouterLink class="link-line" to="/map">查看田块 / 设备位置 →</RouterLink>
      </template>

      <!-- 3: 添加设备 -->
      <template v-if="activeStepKey === 'add-device'">
        <p class="subtle">添加设备功能建设中，请通过后台创建设备安装验收记录。</p>
      </template>

      <!-- 4: 身份 / 绑定 -->
      <template v-if="activeStepKey === 'binding'">
        <p v-if="checksLoading" class="subtle">正在读取验收记录…</p>
        <p v-else-if="checksError" class="warning-text">{{ checksError }}</p>
        <template v-else>
          <p class="subtle">{{ items.length }} 项检查记录中 {{ bindingOkCount }} 项已完成绑定确认</p>
          <p v-for="item in items" :key="item.id" class="list-line">
            {{ item.deviceCode }} <StatusBadge :label="item.bindingOk ? 'BOUND' : 'CHECK'" raw :tone="item.bindingOk ? 'ok' : 'warn'" />
          </p>
          <p v-if="!items.length" class="subtle">暂无验收记录</p>
        </template>
        <p class="warning-text">绑定操作暂未开放：设备绑定候选查询与写入接口尚未针对安装角色完成授权确认，本页仅展示已有检查记录中的绑定状态，不提供发起绑定的入口。</p>
      </template>

      <!-- 5: 电源 / 接线 -->
      <template v-if="activeStepKey === 'power'">
        <p v-if="checksLoading" class="subtle">正在读取验收记录…</p>
        <p v-else-if="checksError" class="warning-text">{{ checksError }}</p>
        <template v-else>
          <p class="subtle">{{ items.length }} 项检查记录中 {{ batteryOkCount }} 项电池状态正常（现场检查记录，非交互式电气测试）</p>
          <p v-for="item in items" :key="item.id" class="list-line">
            {{ item.deviceCode }} <StatusBadge :label="item.batteryOk ? 'OK' : 'CHECK'" raw :tone="item.batteryOk ? 'ok' : 'warn'" />
          </p>
          <p v-if="!items.length" class="subtle">暂无验收记录</p>
        </template>
      </template>

      <!-- 6: 网络 -->
      <template v-if="activeStepKey === 'network'">
        <p v-if="checksLoading" class="subtle">正在读取验收记录…</p>
        <p v-else-if="checksError" class="warning-text">{{ checksError }}</p>
        <template v-else>
          <p class="subtle">{{ items.length }} 项检查记录中 {{ signalOkCount }} 项信号正常</p>
          <p v-for="item in items" :key="item.id" class="list-line">
            {{ item.deviceCode }} <StatusBadge :label="item.signalOk ? 'OK' : 'CHECK'" raw :tone="item.signalOk ? 'ok' : 'warn'" />
          </p>
          <p v-if="!items.length" class="subtle">暂无验收记录</p>
        </template>
      </template>

      <!-- 7: 遥测 -->
      <template v-if="activeStepKey === 'telemetry'">
        <p v-if="checksLoading" class="subtle">正在读取验收记录…</p>
        <p v-else-if="checksError" class="warning-text">{{ checksError }}</p>
        <p v-else class="subtle">{{ items.length }} 项检查记录中 {{ telemetryOkCount }} 项已收到数据</p>
        <p v-if="devicesLoading" class="subtle">正在读取设备遥测…</p>
        <p v-else-if="devicesError" class="warning-text">{{ devicesError }}</p>
        <p v-else class="subtle">设备遥测：{{ devicesOnlineCount }} / {{ devices.length }} 台在线</p>
        <RouterLink class="link-line" to="/devices">查看完整设备遥测 →</RouterLink>
      </template>

      <!-- 8: 执行器检查 -->
      <template v-if="activeStepKey === 'actuator'">
        <p class="subtle">执行器（阀门 / 水泵）验收检查功能建设中。安装角色不提供阀门测试入口 —— 阀门安全测试（模拟）仅限工程师角色使用。</p>
      </template>

      <!-- 9: 联调 -->
      <template v-if="activeStepKey === 'integration'">
        <p class="subtle">当前仅支持部分联调能力：近场蓝牙调试可用，完整端到端联调尚未实现。</p>
        <RouterLink class="link-line" to="/bluetooth-maintenance">蓝牙维护 / 近场调试 →</RouterLink>
      </template>

      <!-- 10: 验收 -->
      <template v-if="activeStepKey === 'acceptance'">
        <p v-if="checksLoading" class="subtle">正在读取验收记录…</p>
        <p v-else-if="checksError" class="warning-text">{{ checksError }}</p>
        <template v-else>
          <p class="subtle">当前检查结果：{{ passedCount }} 项 PASSED，{{ items.length - passedCount }} 项待处理</p>
          <section v-for="item in items" :key="item.id" class="panel">
            <div class="card-topline">
              <strong>{{ item.deviceCode }}</strong>
              <span class="status-pill">{{ item.status }}</span>
            </div>
            <p class="subtle">{{ item.deviceType }} · fieldId={{ item.fieldId ?? '-' }}</p>
            <div class="metric-grid compact">
              <div>Telemetry: {{ item.telemetryOk ? 'OK' : 'CHECK' }}</div>
              <div>Signal: {{ item.signalOk ? 'OK' : 'CHECK' }}</div>
              <div>Battery: {{ item.batteryOk ? 'OK' : 'CHECK' }}</div>
              <div>Binding: {{ item.bindingOk ? 'OK' : 'CHECK' }}</div>
            </div>
          </section>
          <p v-if="!items.length" class="subtle">暂无验收记录</p>
        </template>
        <p class="warning-text">检查结果可查看，但正式验收提交功能尚未实现。</p>
      </template>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { getInstallerChecks } from '../api/production-api';
import { getReadOnlyDevices } from '../api/mobile-api';
import { farmStore } from '../stores/farm.store';

type StepStatus = 'AVAILABLE' | 'PARTIAL' | 'FUTURE';
type StepKey = 'project' | 'field' | 'add-device' | 'binding' | 'power' | 'network' | 'telemetry' | 'actuator' | 'integration' | 'acceptance';

const items = ref<any[]>([]);
const isMock = ref(false);
const checksLoading = ref(true);
const checksError = ref('');

const devices = ref<any[]>([]);
const devicesLoading = ref(true);
const devicesError = ref('');
const devicesOnlineCount = computed(() => devices.value.filter((device) => device.online).length);

const telemetryOkCount = computed(() => items.value.filter((item) => item.telemetryOk).length);
const signalOkCount = computed(() => items.value.filter((item) => item.signalOk).length);
const batteryOkCount = computed(() => items.value.filter((item) => item.batteryOk).length);
const bindingOkCount = computed(() => items.value.filter((item) => item.bindingOk).length);
const passedCount = computed(() => items.value.filter((item) => item.status === 'PASSED').length);

async function loadWorkspace() {
  checksLoading.value = true;
  checksError.value = '';
  devicesLoading.value = true;
  devicesError.value = '';
  // Each source loads and fails independently -- a broken devices lookup must not take down
  // the installer-checks list, and vice versa (UX-1G section 25).
  const [checksResult, devicesResult] = await Promise.allSettled([getInstallerChecks(), getReadOnlyDevices()]);
  if (checksResult.status === 'fulfilled') {
    items.value = Array.isArray(checksResult.value.data) ? checksResult.value.data : [];
    isMock.value = checksResult.value.isMock;
  } else {
    checksError.value = '验收记录读取失败';
  }
  checksLoading.value = false;

  if (devicesResult.status === 'fulfilled') {
    devices.value = devicesResult.value.data.items ?? [];
  } else {
    devicesError.value = '设备遥测读取失败';
  }
  devicesLoading.value = false;
}
onMounted(loadWorkspace);

// UX-1G target commissioning sequence (项目/农场 -> 田块 -> 设备 -> 身份/绑定 -> 电源/接线 ->
// 网络 -> 遥测 -> 执行器检查 -> 联调 -> 验收). Every status here is backed by a real, currently
// verified capability -- see the UX-1G final report's binding-authorization evidence for why
// 身份/绑定 stays PARTIAL rather than exposing a live bind action.
const steps: { key: StepKey; index: number; label: string; status: StepStatus; summary: string; description: string }[] = [
  { key: 'project', index: 1, label: '项目 / 农场', status: 'AVAILABLE', summary: '当前农场上下文', description: '复用登录后已解析的农场上下文（与其他角色共享同一 farmStore），不单独维护安装专用的农场状态。' },
  { key: 'field', index: 2, label: '田块', status: 'AVAILABLE', summary: '通过地图选择田块 / 设备位置', description: '田块选择复用现有地图与田块详情页面，安装角色已拥有这些页面的访问权限，不额外开放新页面。' },
  { key: 'add-device', index: 3, label: '添加设备', status: 'FUTURE', summary: '功能建设中', description: '当前前端与后台均未提供设备新建界面，本步骤如实标注为功能建设中，不展示无效按钮。' },
  { key: 'binding', index: 4, label: '身份 / 绑定', status: 'PARTIAL', summary: '仅展示已有绑定状态，绑定操作暂未开放', description: '设备绑定候选查询与写入接口目前没有针对安装角色的明确授权依据，因此只读取已有验收记录中的绑定状态，不提供发起绑定的入口。' },
  { key: 'power', index: 5, label: '电源 / 接线', status: 'AVAILABLE', summary: '电池状态检查记录', description: '基于验收记录中的电池检查字段，属于现场检查结果读取，不是交互式电气测试。' },
  { key: 'network', index: 6, label: '网络', status: 'AVAILABLE', summary: '信号状态检查记录', description: '基于验收记录中的信号检查字段，回答"设备是否连上、信号是否正常"，不展示 MQTT / PLC 内部细节。' },
  { key: 'telemetry', index: 7, label: '遥测', status: 'AVAILABLE', summary: '是否收到数据', description: '复用验收记录中的遥测检查字段与 /devices 的只读遥测数据，聚焦"是否收到数据"，完整工程级遥测细节保留在工程师工作台。' },
  { key: 'actuator', index: 8, label: '执行器检查', status: 'FUTURE', summary: '功能建设中', description: '尚无面向安装角色的执行器验收界面；阀门安全测试（模拟）是工程师专用工具，安装角色不获得访问权限。' },
  { key: 'integration', index: 9, label: '联调', status: 'PARTIAL', summary: '近场蓝牙调试可用，完整联调尚未实现', description: '蓝牙维护页面提供部分近场联调能力，是完整联调流程中已实现的一部分，而不是全部。' },
  { key: 'acceptance', index: 10, label: '验收', status: 'PARTIAL', summary: '可查看检查结果，正式提交尚未实现', description: '可以查看现有检查记录及其通过/失败状态，但正式的验收提交（签字确认）功能尚未在前端实现。' }
];

const activeStepKey = ref<StepKey>('project');
const activeStep = computed(() => steps.find((step) => step.key === activeStepKey.value)!);
const availableCount = computed(() => steps.filter((step) => step.status === 'AVAILABLE').length);
const partialCount = computed(() => steps.filter((step) => step.status === 'PARTIAL').length);
const futureCount = computed(() => steps.filter((step) => step.status === 'FUTURE').length);

function statusTone(status: StepStatus): 'ok' | 'warn' | 'muted' {
  if (status === 'AVAILABLE') return 'ok';
  if (status === 'PARTIAL') return 'warn';
  return 'muted';
}
</script>
