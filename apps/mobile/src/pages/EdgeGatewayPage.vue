<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Edge</p>
        <h1>Edge 网关</h1>
        <p class="subtle">Edge / PLC 是生产推荐控制路径；当前页面仅展示网关状态 skeleton。</p>
      </div>
    </header>
    <div v-if="isMock" class="mock-banner">Edge API 当前使用 fallback，不执行真实硬件联调。</div>
    <section v-if="!items.length" class="panel">
      <div class="panel-title">暂无 Edge 网关</div>
      <p class="subtle">后续可绑定 PLC / 控制柜 / 田间 Edge Controller。</p>
    </section>
    <section v-for="item in items" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.name }}</strong>
        <span class="status-pill">{{ item.status }}</span>
      </div>
      <p class="subtle">code={{ item.code }} · farmId={{ item.farmId }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import { getEdgeGateways } from '../api/production-api';

const items = ref<any[]>([]);
const isMock = ref(false);

onMounted(async () => {
  const result = await getEdgeGateways();
  items.value = Array.isArray(result.data) ? result.data : [];
  isMock.value = result.isMock;
});
</script>
