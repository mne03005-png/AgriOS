<template>
  <section class="panel ai-panel">
    <div class="panel-title">AI 建议</div>
    <h2>{{ decision?.recommendation ? translateStatusLabel(decision.recommendation) : '暂无建议' }}</h2>
    <p>{{ decision?.reason ?? '等待更多传感器数据。' }}</p>
    <div class="button-row">
      <RouterLink class="primary-button" to="/ai">查看原因</RouterLink>
      <button class="secondary-button">修改</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { translateStatusLabel } from '../../services/status-translation';

defineProps<{ decision: any; plans: any[] }>();
</script>
