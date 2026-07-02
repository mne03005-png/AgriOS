<template>
  <section class="panel compact-panel">
    <div class="card-topline">
      <strong>Fertigation</strong>
      <span class="subtle">{{ tasks.length }} active</span>
    </div>
    <div v-if="tasks.length" class="list-stack">
      <div v-for="task in tasks" :key="task.id" class="mini-row">
        <span>{{ task.id }}</span>
        <strong>{{ task.status }}</strong>
      </div>
    </div>
    <p v-else class="subtle">No active fertigation task.</p>
    <div v-if="warnings.length" class="warning-strip">
      {{ warnings.length }} tank level warning(s)
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ fertigationStatus?: any[]; tankLevelWarnings?: any[] }>();
const tasks = props.fertigationStatus ?? [];
const warnings = props.tankLevelWarnings ?? [];
</script>
