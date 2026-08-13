<template>
  <header class="demo-header">
    <div>
      <p class="eyebrow">AgriOS Mobile</p>
      <h1>农业版特斯拉中控屏</h1>
      <p v-if="farmContextLabel" class="subtle">{{ farmContextLabel }}</p>
    </div>
    <RouterLink class="demo-status-link" to="/demo-status">Demo 状态</RouterLink>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { authStore } from '../../stores/auth.store';
import { farmStore } from '../../stores/farm.store';
import { canonicalRole } from '../../services/permissions';
import { getPlatformMode } from '../../services/platform-mode';

// UX-1H closeout: this banner previously hardcoded "当前农场：洋葱智慧农场 Demo" on every page
// regardless of role/mode/real context -- for SUPER_ADMIN in Platform Mode that directly
// contradicted the mode indicator App.vue's own shell header already shows, making the page
// look farm-scoped when no farm is active. Reuses the same farmStore + getPlatformMode single
// sources of truth App.vue already uses; no new/duplicate context state.
const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));
const mode = computed(() => getPlatformMode(role.value, farmStore.currentFarmId));
const farmContextLabel = computed(() => {
  // Platform Mode: App.vue's header already says "平台模式" authoritatively -- do not also
  // render a farm line here (a null farm line would be misleading, not merely redundant).
  if (mode.value === 'PLATFORM') return null;
  if (farmStore.currentFarmName) return `当前农场：${farmStore.currentFarmName}`;
  // Farm id resolved but its real name hasn't loaded yet (brief window right after a resource
  // correction, e.g. FieldDetailPage.vue) -- same "never fabricate a name" fallback App.vue's
  // own farmName computed already uses, not a new convention.
  if (farmStore.currentFarmId) return `当前农场：农场 ${farmStore.currentFarmId}`;
  // No real farm resolved at all: this is genuinely mock/demo continuity, not a selected farm --
  // must say so honestly rather than presenting a fabricated farm name as if it were real.
  return `当前农场：模拟数据（演示农场）· farmId=${farmStore.currentFarmIdOrDefault}`;
});
</script>
