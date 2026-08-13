<template>
  <div class="app-shell">
    <header class="app-context">
      <div><strong>AgriOS</strong><span class="context-farm">{{ contextLabel }}</span></div>
      <div class="context-status">
        <span :class="['network-dot', { offline: !online }]">{{ online ? '在线' : '离线' }}</span>
        <span>{{ role }}</span>
        <RouterLink v-if="mode === 'FARM_OPERATION'" to="/platform">返回平台模式</RouterLink>
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
import { platformContextStore } from './stores/platform-context.store';
import { getPlatformMode } from './services/platform-mode';
import { canonicalRole, canAccess } from './services/permissions';
import { applyRoleAwareHome, getDefaultRouteForRole } from './services/role-navigation';
import { logout } from './api/auth-api';
import { getFarmById } from './api/farm-api';
import { getTenantById } from './api/tenant-api';

const online = ref(navigator.onLine);
const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));
// UX-1H single source of truth for SUPER_ADMIN's Platform Mode vs Farm Operation Mode; null for
// every other role (see services/platform-mode.ts).
const mode = computed(() => getPlatformMode(role.value, farmStore.currentFarmId));
// Real farm name once resolved (login/me already return it); falls back to the raw id while a
// name isn't known yet (e.g. right after a field-driven farm correction), and to a neutral
// label only when no farm has been resolved at all -- never fabricates a name.
const farmName = computed(() => farmStore.currentFarmName ?? (farmStore.currentFarmId ? `农场 ${farmStore.currentFarmId}` : '请选择农场'));
// UX-1H: SUPER_ADMIN's header context area must never look like an ordinary active farm
// (section 5) and must unmistakably say which mode is active (section 11). Every other role's
// label is completely unchanged.
const contextLabel = computed(() => {
  if (mode.value === 'PLATFORM') return '平台模式';
  if (mode.value === 'FARM_OPERATION') {
    const tenantLabel = platformContextStore.selectedTenantName ?? '未知租户';
    return `农场运营 · ${tenantLabel} / ${farmName.value}`;
  }
  return farmName.value;
});
// Fires on initial mount (session restoration) and on every authStore.user reference change
// (fresh login via setSession, refreshed profile via setUser, logout via clear() -> null).
// This is the ONLY place initial farm resolution is wired -- FieldDetailPage.vue separately
// calls farmStore.setCurrentFarm() directly when a field proves a different farm, which is a
// later, stronger correction this watcher must not fight (it only reacts to identity changes).
watch(() => authStore.user, () => farmStore.resolveInitialFarm(), { immediate: true });
// UX-1H: whenever SUPER_ADMIN's active farm changes (via the Platform-page picker, or via a
// direct resource deep link such as /fields/:fieldId correcting farmStore on its own -- section
// 8's "resource context beats stale mode/cache state"), resolve which tenant that farm actually
// belongs to straight from the farm resource itself, never from whatever the picker last set.
// This is the authoritative path; SuperAdminPage.vue's picker also sets platformContextStore
// eagerly for an instant label, and this watcher confirms/corrects it from source of truth.
watch(
  () => (role.value === 'SUPER_ADMIN' ? farmStore.currentFarmId : null),
  async (farmId) => {
    if (!farmId) { platformContextStore.clear(); return; }
    const requestedFarmId = farmId;
    const farmResult = await getFarmById(farmId);
    if (requestedFarmId !== farmStore.currentFarmId) return;
    const tenantId = farmResult.data?.tenantId;
    if (!tenantId) return;
    const tenantResult = await getTenantById(tenantId);
    if (requestedFarmId !== farmStore.currentFarmId) return;
    platformContextStore.selectTenant(tenantId, tenantResult.data?.name ?? tenantId);
  },
  { immediate: true }
);
// UX-1E accepted six-domain desktop shell for FARMER/MANAGER, in this exact order:
// 首页/田块/作业/告警/数据/我的. primaryNavigation itself stays mobile's 首页/田块/作业/告警/我的
// (AppTabBar.vue consumes it unchanged) -- desktop inserts the 数据 entry ahead of 我的 by path
// rather than hardcoding an index, so this keeps working if primaryNavigation's shape changes.
// FARMER/MANAGER keep the existing farm-operation-first order (their default landing is
// already first). INSTALLER/ENGINEER/SUPER_ADMIN get their default workspace floated to the
// top as a "default focus" cue -- access itself is unchanged, this is a stable reorder over the
// same canAccess-filtered list.
// UX-1H: SUPER_ADMIN gets an explicit, mode-dependent desktop shell instead of the previous
// "normal farm nav + workspace nav, both always visible" mix (section 5/25). Platform Mode shows
// only the existing workspace tools (unchanged from before UX-1H). Farm Operation Mode shows the
// accepted normal farm shell AS-IS (primaryNavigation unmodified, so 首页 stays literally
// /cockpit -- applyRoleAwareHome is deliberately NOT used here, since it would rewrite 首页 to
// /platform, which is wrong while actively operating a farm) -- never both at once, and never
// workspaceNavigation's other items (安装任务/工程师工作台) mixed into farm-operation display.
function superAdminNavigation() {
  if (mode.value === 'FARM_OPERATION') {
    const profileIndex = primaryNavigation.findIndex((item) => item.path === '/profile');
    return profileIndex === -1
      ? [...primaryNavigation, ...desktopSecondaryNavigation]
      : [...primaryNavigation.slice(0, profileIndex), ...desktopSecondaryNavigation, ...primaryNavigation.slice(profileIndex)];
  }
  return workspaceNavigation.filter((item) => canAccess(item.roles, role.value));
}
const visibleNavigation = computed(() => {
  if (role.value === 'SUPER_ADMIN') return superAdminNavigation();
  const home = applyRoleAwareHome(primaryNavigation, role.value);
  const profileIndex = home.findIndex((item) => item.path === '/profile');
  const withDesktopSecondary = profileIndex === -1
    ? [...home, ...desktopSecondaryNavigation]
    : [...home.slice(0, profileIndex), ...desktopSecondaryNavigation, ...home.slice(profileIndex)];
  const combined = [...withDesktopSecondary, ...workspaceNavigation].filter((item) => canAccess(item.roles, role.value));
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
