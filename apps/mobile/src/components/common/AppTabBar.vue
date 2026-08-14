<template>
  <nav class="tabbar">
    <RouterLink v-for="item in tabs" :key="item.path" :to="item.path" class="tabbar-item">
      <NavIcon class="tabbar-icon" :name="item.icon" />
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import NavIcon from './NavIcon.vue';
import { primaryNavigation, workspaceNavigation } from '../../config/navigation';
import { authStore } from '../../stores/auth.store';
import { farmStore } from '../../stores/farm.store';
import { canAccess, canonicalRole } from '../../services/permissions';
import { applyRoleAwareHome } from '../../services/role-navigation';
import { getPlatformMode } from '../../services/platform-mode';

// FARMER and MANAGER keep the normal farm-operation tab shell -- UX-1E's accepted final
// domain labels (首页/田块/作业/告警/我的), not a redesign of the shell itself.
// INSTALLER/ENGINEER keep their own workspace shell, reusing the same canAccess-filtered
// workspaceNavigation the desktop sidebar already uses -- no new/duplicate authorization logic.
// UX-1H: SUPER_ADMIN's mobile shell now depends on mode -- Platform Mode keeps the existing
// workspace shell (unchanged), Farm Operation Mode reuses the accepted normal farm tab shell
// AS-IS (not applyRoleAwareHome-rewritten, so 首页 stays literally /cockpit while operating a
// farm; App.vue's desktop sidebar mirrors this same rule).
const role = computed(() => canonicalRole(authStore.user?.canonicalRole ?? authStore.user?.role));
const mode = computed(() => getPlatformMode(role.value, farmStore.currentFarmId));
const tabs = computed(() => {
  if (role.value === 'FARMER' || role.value === 'MANAGER') return applyRoleAwareHome(primaryNavigation, role.value);
  if (role.value === 'SUPER_ADMIN' && mode.value === 'FARM_OPERATION') return primaryNavigation;
  return workspaceNavigation.filter((item) => canAccess(item.roles, role.value));
});
</script>
