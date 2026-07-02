<template>
  <section class="panel compact-panel">
    <div class="card-topline">
      <strong>Farm Activity</strong>
      <span class="subtle">{{ items.length }} latest</span>
    </div>
    <div class="timeline-list">
      <div v-for="item in items" :key="item.id" class="timeline-item">
        <strong>{{ item.title ?? item.type }}</strong>
        <span>{{ item.type }} · {{ formatTime(item.createdAt) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ activities?: any[] }>();
const items = props.activities ?? [];

function formatTime(value?: string) {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}
</script>
