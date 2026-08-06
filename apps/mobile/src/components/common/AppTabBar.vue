<template>
  <nav class="tabbar">
    <RouterLink v-for="item in tabs" :key="item.path" :to="item.path" class="tabbar-item">
      <span class="tabbar-icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { primaryNavigation as tabs } from '../../config/navigation';
</script>
