<template>
  <section class="panel">
    <div class="panel-title">手动阀门</div>
    <div class="button-row">
      <button class="primary-button" @click="confirmValve('VALVE_OPEN')">开阀</button>
      <button class="secondary-button" @click="confirmValve('VALVE_CLOSE')">关阀</button>
    </div>
  </section>
</template>

<script setup lang="ts">
const emit = defineEmits<{ command: [command: 'VALVE_OPEN' | 'VALVE_CLOSE'] }>();

function confirmValve(command: 'VALVE_OPEN' | 'VALVE_CLOSE') {
  if (window.confirm(`确认${command === 'VALVE_OPEN' ? '开阀' : '关阀'}？危险操作会继续受后端安全策略控制。`)) emit('command', command);
}
</script>
