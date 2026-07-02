<template>
  <section class="panel compact-panel">
    <div class="card-topline">
      <strong>Pump Status</strong>
      <span class="subtle">{{ items.length }} devices</span>
    </div>
    <div v-if="items.length" class="list-stack">
      <div v-for="item in items" :key="item.deviceId" class="mini-row">
        <span>{{ item.deviceId }}</span>
        <strong>{{ item.status ?? 'UNKNOWN' }}</strong>
      </div>
    </div>
    <p v-else class="subtle">No pump telemetry yet.</p>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ pumpStatus?: any[] }>();
const items = props.pumpStatus ?? [];
</script>
