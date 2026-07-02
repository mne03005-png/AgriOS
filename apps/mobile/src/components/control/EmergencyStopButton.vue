<template>
  <button class="danger-button" @click="handleClick">一键停水</button>
</template>

<script setup lang="ts">
const emit = defineEmits<{ stop: [] }>();

function handleClick() {
  if (window.confirm('确认执行一键停水？该操作会提交后端安全策略处理。')) emit('stop');
}
</script>
