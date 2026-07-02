<template>
  <nav class="tabbar">
    <RouterLink v-for="item in tabs" :key="item.path" :to="item.path" class="tabbar-item">
      <span class="tabbar-icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
const tabs = [
  { path: '/cockpit', label: 'Cockpit', icon: 'C' },
  { path: '/map', label: 'Map', icon: 'M' },
  { path: '/operations', label: 'Ops', icon: 'O' },
  { path: '/drone-operations', label: 'Drone', icon: 'D' },
  { path: '/ai', label: 'AI', icon: 'A' },
  { path: '/profile', label: 'Me', icon: 'P' }
];
</script>
