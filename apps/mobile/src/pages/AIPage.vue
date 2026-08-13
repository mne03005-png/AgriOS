<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前显示的是模拟建议数据。</div>
    <header class="section-header">
      <div>
        <h1>AI 农业建议</h1>
        <p class="subtle">仅生成建议，不自动执行。所有危险动作仍需人工审批。</p>
      </div>
    </header>

    <section v-if="!items.length" class="panel">
      <div class="panel-title">暂无 AI 建议</div>
      <p class="subtle">系统会根据传感器和作业数据自动生成建议，暂无数据时不显示。</p>
    </section>

    <section v-for="item in items" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.title ?? translateStatusLabel(item.recommendation) }}</strong>
        <span class="status-pill">{{ translateStatusLabel(item.severity ?? 'LOW') }}</span>
      </div>
      <p>{{ item.summary ?? item.reason }}</p>
      <p class="subtle">{{ item.explanation ?? '建议需要人工确认后执行。' }}</p>
      <pre class="json-block">{{ JSON.stringify(item.evidenceJson ?? item.evidence ?? {}, null, 2) }}</pre>
    </section>

    <section class="button-row">
      <button class="primary-button" disabled>执行需审批</button>
      <button class="secondary-button" disabled>标记解决</button>
      <button class="secondary-button" disabled>忽略建议</button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAIRecommendationList } from '../api/production-api';
import { defaultFarmId, mockRecommendations } from '../api/mock-data';
import { translateStatusLabel } from '../services/status-translation';

const items = ref<any[]>(mockRecommendations);
const isMock = ref(true);

onMounted(async () => {
  const result = await getAIRecommendationList(defaultFarmId);
  items.value = Array.isArray(result.data) && result.data.length ? result.data : mockRecommendations;
  isMock.value = result.isMock;
});
</script>
