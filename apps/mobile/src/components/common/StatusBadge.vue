<template>
  <span class="status-badge" :class="tone">{{ label }}</span>
</template>

<script setup lang="ts">
defineProps<{ label: string; tone?: 'ok' | 'warn' | 'danger' | 'muted' }>();
</script>
