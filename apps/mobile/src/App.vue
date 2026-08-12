<template>
  <div class="app-shell">
    <header class="app-context">
      <div><strong>AgriOS</strong><span class="context-farm">{{ farmName }}</span></div>
      <div class="context-status">
        <span :class="['network-dot', { offline: !online }]">{{ online ? '在线' : '离线' }}</span>
        <span>{{ role }}</span>
        <RouterLink to="/alerts">告警</RouterLink>
        <button v-if="authStore.isLoggedIn" class="text-button" @click="signOut">退出</button>
      </div>
    </header>
    <aside class="desktop-nav" aria-label="桌面导航">
      <RouterLink v-for="item in visibleNavigation" :key="item.path" :to="item.path">{{ item.icon }} {{ item.label }}</RouterLink>
    </aside>
    <main class="app-main">
      <RouterView />
    </main>
    <AppTabBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppTabBar from './components/common/AppTabBar.vue';
import { primaryNavigation, desktopSecondaryNavigation, workspaceNavigation } from './config/navigation';
import { authStore } from './stores/auth.store';
import { farmStore } from './stores/farm.store';
import { canonicalRole, canAccess } from './services/permissions';
import { applyRoleAwareHome, getDefaultRouteForRole } from './services/role-navigation';
import { logout } from './api/auth-api';

const online = ref(navigator.onLine);
const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));
// Real farm name once resolved (login/me already return it); falls back to the raw id while a
// name isn't known yet (e.g. right after a field-driven farm correction), and to a neutral
// label only when no farm has been resolved at all -- never fabricates a name.
const farmName = computed(() => farmStore.currentFarmName ?? (farmStore.currentFarmId ? `农场 ${farmStore.currentFarmId}` : '请选择农场'));
// Fires on initial mount (session restoration) and on every authStore.user reference change
// (fresh login via setSession, refreshed profile via setUser, logout via clear() -> null).
// This is the ONLY place initial farm resolution is wired -- FieldDetailPage.vue separately
// calls farmStore.setCurrentFarm() directly when a field proves a different farm, which is a
// later, stronger correction this watcher must not fight (it only reacts to identity changes).
watch(() => authStore.user, () => farmStore.resolveInitialFarm(), { immediate: true });
// UX-1E accepted six-domain desktop shell for FARMER/MANAGER (首页/田块/作业/告警/数据/我的):
// primaryNavigation (with 首页 resolved to the actual role-aware landing) plus the desktop-
// only 数据 entry. FARMER/MANAGER keep the existing farm-operation-first order (their default
// landing is already first). INSTALLER/ENGINEER/SUPER_ADMIN get their default workspace
// floated to the top as a "default focus" cue -- access itself is unchanged, this is a stable
// reorder over the same canAccess-filtered list.
const visibleNavigation = computed(() => {
  const combined = [...applyRoleAwareHome(primaryNavigation, role.value), ...desktopSecondaryNavigation, ...workspaceNavigation].filter((item) => canAccess(item.roles, role.value));
  // MANAGER's resolved 首页 now points at the same /manager destination as workspaceNavigation's
  // own 管理工作台 entry (applyRoleAwareHome above); keep only the first (首页) to avoid two
  // links to the identical page, consistent with UX-1E's one-canonical-discovery-home principle.
  const deduped = combined.filter((item, index) => combined.findIndex((other) => other.path === item.path) === index);
  if (role.value === 'FARMER' || role.value === 'MANAGER') return deduped;
  const defaultPath = getDefaultRouteForRole(role.value);
  return [...deduped].sort((a, b) => Number(b.path === defaultPath) - Number(a.path === defaultPath));
});
const updateNetwork = () => { online.value = navigator.onLine; };
onMounted(() => { window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork); });
onBeforeUnmount(() => { window.removeEventListener('online', updateNetwork); window.removeEventListener('offline', updateNetwork); });
async function signOut() { if (authStore.token) await logout(authStore.token); authStore.clear(); location.assign('/login'); }
</script>
