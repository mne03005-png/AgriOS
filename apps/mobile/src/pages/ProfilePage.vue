<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Profile</p>
        <h1>我的</h1>
        <p class="subtle">账号、租户、农场和生产安全状态。</p>
      </div>
    </header>

    <section v-if="loading" class="card">
      <p class="subtle">正在加载登录状态...</p>
    </section>

    <section v-else-if="!authStore.isLoggedIn" class="card">
      <h2>未登录</h2>
      <p class="subtle">请先登录后访问农场数据。</p>
      <RouterLink class="primary-button" to="/login">去登录</RouterLink>
    </section>

    <section v-else class="card">
      <p class="eyebrow">Auth</p>
      <h2>{{ authStore.user?.name }}</h2>
      <p class="subtle">role={{ authStore.user?.role }}</p>
      <p class="subtle">tenantId={{ authStore.user?.tenantId ?? '-' }}</p>
      <p class="subtle">farmId={{ authStore.user?.farmId ?? '-' }}</p>
      <p class="subtle">当前控制模式：{{ health.deviceControlMode ?? 'MOCK' }}</p>
      <div class="button-row">
        <RouterLink class="primary-button" to="/change-password">修改密码</RouterLink>
        <button class="ghost-button" @click="logoutCurrent">退出登录</button>
      </div>
    </section>

    <section v-if="authStore.isLoggedIn && !canExecute" class="panel">
      <div class="panel-title">权限提示</div>
      <p class="warning-text">当前角色无权执行高风险动作。设备控制必须经过安全策略、审批和审计。</p>
    </section>

    <section v-if="authStore.isLoggedIn" class="profile-list">
      <RouterLink v-for="item in visibleItems" :key="item.label" :to="item.path">{{ item.label }}</RouterLink>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DemoHeader from '../components/common/DemoHeader.vue';
import { getHealthReady } from '../api/production-api';
import { logout, me } from '../api/auth-api';
import { authStore } from '../stores/auth.store';

const router = useRouter();
const health = ref<any>({});
const loading = ref(true);

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
  try {
    if (authStore.token) {
      const profile = await me(authStore.token);
      authStore.setUser(profile.user);
    }
    const result = await getHealthReady();
    health.value = result.data;
  } catch {
    authStore.clear();
  } finally {
    loading.value = false;
  }
});

async function logoutCurrent() {
  const token = authStore.token;
  authStore.clear();
  if (token) await logout(token);
  await router.replace('/login');
}

const items = [
  { label: '进入农场驾驶舱', path: '/cockpit' },
  { label: '地图', path: '/map' },
  { label: '农事与设备', path: '/operations' },
  { label: '告警', path: '/alerts' },
  { label: '报表', path: '/reports' },
  { label: '无人机作业', path: '/drone-operations' },
  { label: 'AI 建议', path: '/ai' },
  { label: '设备安装验收', path: '/installer-checks', installerOnly: true },
  { label: '真实设备接入调试', path: '/device-integration', installerOnly: true },
  { label: '阀门安全测试', path: '/valve-control-test', installerOnly: true }
];
</script>
