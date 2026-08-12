<template>
  <nav class="tabbar">
    <RouterLink v-for="item in tabs" :key="item.path" :to="item.path" class="tabbar-item">
      <span class="tabbar-icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { primaryNavigation, workspaceNavigation } from '../../config/navigation';
import { authStore } from '../../stores/auth.store';
import { canAccess, canonicalRole } from '../../services/permissions';
import { applyRoleAwareHome } from '../../services/role-navigation';

// FARMER and MANAGER keep the normal farm-operation tab shell -- UX-1E's accepted final
// domain labels (首页/田块/作业/告警/我的), not a redesign of the shell itself.
// INSTALLER/ENGINEER/SUPER_ADMIN get their own workspace shell instead, reusing the same
// canAccess-filtered workspaceNavigation the desktop sidebar already uses -- no new/duplicate
// authorization logic.
const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));
const tabs = computed(() => {
  if (role.value === 'FARMER' || role.value === 'MANAGER') return applyRoleAwareHome(primaryNavigation, role.value);
  return workspaceNavigation.filter((item) => canAccess(item.roles, role.value));
});
</script>
