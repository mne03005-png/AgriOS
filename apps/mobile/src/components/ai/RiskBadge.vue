<template>
  <span class="risk-badge" :class="level.toLowerCase()">{{ level }}</span>
</template>

<script setup lang="ts">
defineProps<{ level: string }>();
</script>
