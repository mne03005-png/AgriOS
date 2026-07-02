<template>
  <section class="quick-actions">
    <EmergencyStopButton @stop="$emit('emergency-stop')" />
    <button class="primary-button" @click="confirmValve">手动开阀</button>
    <button class="secondary-button" disabled>自动模式</button>
    <RouterLink class="secondary-button" to="/alerts">查看告警</RouterLink>
  </section>
</template>

<script setup lang="ts">
import EmergencyStopButton from '../control/EmergencyStopButton.vue';

const emit = defineEmits<{ 'emergency-stop': []; valve: [] }>();

function confirmValve() {
  if (window.confirm('确认提交手动开阀请求？后端安全策略仍会拦截高风险操作。')) emit('valve');
}
</script>
