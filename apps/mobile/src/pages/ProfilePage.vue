<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Settings</p>
        <h1>我的</h1>
        <p class="subtle">农场系统设置、登录状态与生产化入口</p>
      </div>
    </header>

    <section class="card">
      <p class="eyebrow">Auth</p>
      <h2>{{ authStore.isLoggedIn ? authStore.user?.name : 'Demo 模式' }}</h2>
      <p class="subtle">
        {{ authStore.isLoggedIn ? `tenantId=${authStore.user?.tenantId ?? '-'} · role=${authStore.user?.role}` : '未登录时仍默认访问 demo farm，便于演示和验收。' }}
      </p>
      <p class="subtle">当前控制模式：{{ health.deviceControlMode ?? 'MOCK' }} · farmId=demo</p>
      <p class="subtle">ThingsBoard 用于设备调试，AgriOS 用于农业驾驶舱。</p>
      <RouterLink class="primary-button" to="/login">{{ authStore.isLoggedIn ? '管理登录状态' : '登录 Demo 用户' }}</RouterLink>
    </section>

    <section v-if="!canExecute" class="panel">
      <div class="panel-title">权限提示</div>
      <p class="warning-text">当前角色无权限执行高风险动作，请联系农场管理员。开泵、开阀、施肥必须经过 Safety / Approval / ActionQueue。</p>
    </section>

    <section class="profile-list">
      <RouterLink v-for="item in visibleItems" :key="item.label" :to="item.path">{{ item.label }}</RouterLink>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import { getHealthReady } from '../api/production-api';
import { authStore } from '../stores/auth.store';

const health = ref<any>({});

const canExecute = computed(() => {
  const role = authStore.user?.role;
  return ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'FARM_MANAGER', 'MAINTAINER'].includes(role ?? '');
});

const visibleItems = computed(() => {
  const role = authStore.user?.role;
  const isInstaller = ['INSTALLER', 'MAINTAINER', 'TENANT_ADMIN', 'PLATFORM_ADMIN'].includes(role ?? '');
  return items.filter((item) => !item.installerOnly || isInstaller);
});

onMounted(async () => {
  const result = await getHealthReady();
  health.value = result.data;
});

const items = [
  { label: '一键演示路径', path: '/showcase' },
  { label: '进入 Demo 农场', path: '/cockpit' },
  { label: 'Demo 状态检查', path: '/demo-status' },
  { label: '无人机作业', path: '/drone-operations' },
  { label: '无人机审核台', path: '/drone-reviews' },
  { label: '项目报表', path: '/reports' },
  { label: '设备安装验收', path: '/installer-checks', installerOnly: true },
  { label: '真实设备接入调试', path: '/device-integration', installerOnly: true },
  { label: '阀门安全测试', path: '/valve-control-test', installerOnly: true },
  { label: 'Edge 网关状态', path: '/edge-gateways', installerOnly: true },
  { label: '蓝牙安装维护', path: '/bluetooth-maintenance', installerOnly: true },
  { label: '地图边界审核', path: '/boundaries/review' },
  { label: '设备与作业', path: '/operations' },
  { label: '安全与告警', path: '/alerts' }
];
</script>
