<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为 AI 建议 mock fallback。</div>
    <header class="section-header">
      <div>
        <p class="eyebrow">Explainable AI</p>
        <h1>AI 农业建议</h1>
        <p class="subtle">仅生成建议，不自动执行。所有危险动作仍走 Approval / ActionQueue。</p>
      </div>
    </header>

    <section v-if="!items.length" class="panel">
      <div class="panel-title">暂无 AI 建议</div>
      <p class="subtle">可以调用 /api/v1/ai-recommendations/analyze/farm/demo 生成规则型建议。</p>
    </section>

    <section v-for="item in items" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.title ?? item.recommendation }}</strong>
        <span class="status-pill">{{ item.severity ?? 'LOW' }}</span>
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
import DemoHeader from '../components/common/DemoHeader.vue';
import { getAIRecommendationList } from '../api/production-api';
import { defaultFarmId, mockRecommendations } from '../api/mock-data';

const items = ref<any[]>(mockRecommendations);
const isMock = ref(true);

onMounted(async () => {
  const result = await getAIRecommendationList(defaultFarmId);
  items.value = Array.isArray(result.data) && result.data.length ? result.data : mockRecommendations;
  isMock.value = result.isMock;
});
</script>
