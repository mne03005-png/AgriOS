<template>
  <header class="farm-header">
    <div>
      <p class="eyebrow">AgriOS Cockpit</p>
      <h1>{{ farm?.name ?? '农业中控' }}</h1>
      <p class="subtle">{{ weather?.summary ?? '天气数据准备中' }}</p>
    </div>
    <div class="online-ring">
      <strong>{{ onlineRate }}%</strong>
      <span>在线</span>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ farm: any; weather: any; onlineRate: number }>();
</script>
