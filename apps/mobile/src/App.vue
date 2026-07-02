<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <AppTabBar />
  </div>
</template>

<script setup lang="ts">
import AppTabBar from './components/common/AppTabBar.vue';
</script>
