<template>
  <div class="loading-state">
    <div class="loading-dot"></div>
    <span>{{ text ?? '加载中' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ text?: string }>();
</script>
