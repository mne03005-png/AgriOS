<template>
  <section class="page">
    <header class="section-header">
      <div>
        <h1>我的</h1>
        <p class="subtle">账号、农场与安全状态。</p>
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

    <template v-else>
      <!-- 身份卡片: name + localized role + current farm only -- never a raw role/tenant/farm code -->
      <section class="card">
        <h2>{{ authStore.user?.name }}</h2>
        <p class="subtle">{{ roleLabel(authStore.user?.canonicalRole ?? authStore.user?.role) }}</p>
        <p v-if="farmStore.currentFarmName" class="subtle">当前农场：{{ farmStore.currentFarmName }}</p>
      </section>

      <section v-if="!canExecute" class="panel">
        <div class="panel-title">权限提示</div>
        <p class="warning-text">当前角色无权执行高风险动作。设备控制必须经过安全策略、审批和审计。</p>
      </section>

      <section class="panel">
        <div class="panel-title">账号安全</div>
        <div class="profile-list">
          <RouterLink to="/change-password">修改密码</RouterLink>
        </div>
      </section>

      <!-- PROD-USABILITY-1 section 18: 报表/AI 建议 stay here deliberately, not moved into their
           own domain workflow yet -- mobile's primaryNavigation is capped at 5 items and
           desktopSecondaryNavigation's 数据 entry is desktop-only (UX-1E section 13), so this is
           currently the ONLY mobile discovery path to /reports and /ai. Removing them would
           strand those pages on mobile, not simplify anything. See the PROD-USABILITY-1 final
           report for the proposed follow-up (a real 数据 mobile entry point) that would let this
           section shrink further without a regression. -->
      <section v-if="toolItems.length" class="panel">
        <div class="panel-title">农场数据与工具</div>
        <div class="profile-list">
          <RouterLink v-for="item in toolItems" :key="item.label" :to="item.path">{{ item.label }}</RouterLink>
        </div>
      </section>

      <section v-if="installerItems.length" class="panel">
        <div class="panel-title">安装与工程</div>
        <div class="profile-list">
          <RouterLink v-for="item in installerItems" :key="item.label" :to="item.path">{{ item.label }}</RouterLink>
        </div>
      </section>

      <button class="ghost-button link-button" @click="logoutCurrent">退出登录</button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { logout, me } from '../api/auth-api';
import { authStore } from '../stores/auth.store';
import { farmStore } from '../stores/farm.store';
import { canAccess, roleLabel } from '../services/permissions';

const router = useRouter();
const loading = ref(true);

const canExecute = computed(() => {
  const role = authStore.user?.role;
  return ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'FARM_MANAGER', 'MAINTAINER'].includes(role ?? '');
});

// UX-HOTFIX-1: 我的 is a personal/account page, not a second navigation home -- 首页/田块/作业/
// 告警 (and their UX-1E synonyms 进入农场驾驶舱/地图) are never listed here, only genuine
// capabilities with no home in the 5-item bottom navigation (报表/AI 建议/无人机作业 -- carried
// over unchanged from UX-1E's own dedup pass) and installer-only diagnostic tools.
const toolItems = computed(() => {
  const canSeeDrone = canAccess(['MANAGER', 'ENGINEER', 'SUPER_ADMIN'], authStore.user?.canonicalRole ?? authStore.user?.role);
  return baseTools.filter((item) => !item.roleGated || canSeeDrone);
});

const installerItems = computed(() => {
  const role = authStore.user?.role;
  const isInstaller = ['INSTALLER', 'MAINTAINER', 'TENANT_ADMIN', 'PLATFORM_ADMIN'].includes(role ?? '');
  return isInstaller ? installerTools : [];
});

onMounted(async () => {
  try {
    if (authStore.token) {
      const profile = await me(authStore.token);
      authStore.setUser(profile.user);
    }
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

const baseTools = [
  { label: '报表', path: '/reports' },
  { label: 'AI 建议', path: '/ai' },
  { label: '无人机作业', path: '/drone-operations', roleGated: true }
];
const installerTools = [
  { label: '设备安装验收', path: '/installer-checks' },
  { label: '真实设备接入调试', path: '/device-integration' },
  { label: '阀门安全测试', path: '/valve-control-test' }
];
</script>
