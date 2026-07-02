<template>
  <section class="mode-switch">
    <button :class="{ active: mode === 'MANUAL' }">手动</button>
    <button :class="{ active: mode === 'ASSISTED' }">辅助</button>
    <button disabled>自动</button>
  </section>
</template>

<script setup lang="ts">
defineProps<{ mode: 'MANUAL' | 'ASSISTED' | 'AUTO' }>();
</script>
