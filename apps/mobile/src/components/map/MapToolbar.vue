<template>
  <nav class="segmented map-view-switch">
    <button type="button" :class="{ active: modelValue === 'map' }" @click="$emit('update:modelValue', 'map')">地图</button>
    <button type="button" :class="{ active: modelValue === 'list' }" @click="$emit('update:modelValue', 'list')">列表</button>
  </nav>
</template>

<script setup lang="ts">
// UX-HOTFIX-1: replaces the previous four dead provider buttons (Google/高德/百度/无人机 --
// none had a click handler, none were wired to any state, and none reflected a real map
// provider; see map-adapters/*.adapter.ts, which are all MockMapAdapter aliases with a
// load-the-real-SDK TODO). 田块 owns spatial farm exploration end-to-end; this is its one
// compact, genuinely functional view switch, not a provider chooser.
defineProps<{ modelValue: 'map' | 'list' }>();
defineEmits<{ 'update:modelValue': [value: 'map' | 'list'] }>();
</script>
