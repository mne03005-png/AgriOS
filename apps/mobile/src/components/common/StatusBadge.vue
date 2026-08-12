<template>
  <span class="status-badge" :class="tone" :title="label">{{ displayLabel }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { translateStatusLabel } from '../../services/status-translation';

const props = defineProps<{ label: string; tone?: 'ok' | 'warn' | 'danger' | 'muted'; raw?: boolean }>();

// raw is preserved internally (title attribute, and available to engineer-only callers via
// the raw prop) even when the visible label is translated for normal-user surfaces.
const displayLabel = computed(() => (props.raw ? props.label : translateStatusLabel(props.label)));
</script>
