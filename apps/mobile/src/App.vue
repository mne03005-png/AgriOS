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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppTabBar from './components/common/AppTabBar.vue';
import { primaryNavigation, workspaceNavigation } from './config/navigation';
import { authStore } from './stores/auth.store';
import { canonicalRole, canAccess } from './services/permissions';
import { getDefaultRouteForRole } from './services/role-navigation';
import { logout } from './api/auth-api';

const online = ref(navigator.onLine);
const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));
const farmName = computed(() => (authStore.user?.farmId ? `农场 ${authStore.user.farmId}` : '请选择农场'));
// FARMER/MANAGER keep the existing farm-operation-first order (their default landing is
// already first, /cockpit, or unemphasized, /manager). INSTALLER/ENGINEER/SUPER_ADMIN get
// their default workspace floated to the top as a "default focus" cue -- access itself is
// unchanged, this is a stable reorder over the same canAccess-filtered list.
const visibleNavigation = computed(() => {
  const combined = [...primaryNavigation, ...workspaceNavigation].filter((item) => canAccess(item.roles, role.value));
  if (role.value === 'FARMER' || role.value === 'MANAGER') return combined;
  const defaultPath = getDefaultRouteForRole(role.value);
  return [...combined].sort((a, b) => Number(b.path === defaultPath) - Number(a.path === defaultPath));
});
const updateNetwork = () => { online.value = navigator.onLine; };
onMounted(() => { window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork); });
onBeforeUnmount(() => { window.removeEventListener('online', updateNetwork); window.removeEventListener('offline', updateNetwork); });
async function signOut() { if (authStore.token) await logout(authStore.token); authStore.clear(); location.assign('/login'); }
</script>
