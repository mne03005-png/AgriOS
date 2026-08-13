<template>
  <section class="panel compact-panel">
    <div class="card-topline">
      <strong>最近动态</strong>
      <span class="subtle">最新 {{ items.length }} 条</span>
    </div>
    <div class="timeline-list">
      <div v-for="item in items" :key="item.id" class="timeline-item">
        <strong>{{ item.title ?? translateStatusLabel(item.type) }}</strong>
        <span>{{ translateStatusLabel(item.type) }} · {{ formatTime(item.createdAt) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { translateStatusLabel } from '../../services/status-translation';

const props = defineProps<{ activities?: any[] }>();
const items = props.activities ?? [];

function formatTime(value?: string) {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}
</script>
