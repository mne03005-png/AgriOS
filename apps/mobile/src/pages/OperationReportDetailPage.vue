<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前为模拟报告详情</div>
    <header class="section-header compact">
      <div>
        <p class="eyebrow">Operation Report</p>
        <h2>{{ report.title ?? report.type }}</h2>
        <p class="subtle">{{ report.type }} · {{ report.createdAt ? new Date(report.createdAt).toLocaleString() : '--' }}</p>
      </div>
    </header>

    <section class="metric-grid">
      <Metric label="作业地块" :value="summary.fieldId ?? '--'" />
      <Metric label="作业面积" :value="`${metrics.actualAreaMu ?? 0} mu`" />
      <Metric label="覆盖率" :value="percent(metrics.coverageRate)" />
      <Metric label="漏喷面积" :value="`${metrics.missedAreaMu ?? 0} mu`" />
      <Metric label="用药量" :value="`${metrics.sprayVolumeL ?? 0} L`" />
      <Metric label="亩用量" :value="`${metrics.dosagePerMu ?? 0} L/mu`" />
      <Metric label="成本" :value="`${summary.operationCostSummary?.totalAmount ?? 0} ${summary.operationCostSummary?.currency ?? 'CNY'}`" />
      <Metric label="图层" :value="summary.mapLayerIds?.length ?? 0" />
    </section>

    <section class="panel">
      <div class="panel-title">异常与审核</div>
      <p>人工复核：{{ summary.needsManualReview ? '需要' : '不需要' }}</p>
      <p>航线距离：{{ metrics.flightDistanceM ?? '--' }} m</p>
      <p>作业时长：{{ metrics.flightDurationS ?? '--' }} s</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getOperationReport } from '../api/operation-report-api';

const route = useRoute();
const report = ref<any>({});
const isMock = ref(true);
const summary = computed(() => report.value.summaryJson ?? {});
const metrics = computed(() => report.value.metricsJson ?? {});

const Metric = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number], required: true } },
  setup(props) {
    return () => h('div', { class: 'metric-card' }, [h('span', props.label), h('strong', String(props.value))]);
  }
});

onMounted(async () => {
  const result = await getOperationReport(String(route.params.id));
  report.value = result.data;
  isMock.value = result.isMock;
});

function percent(value?: number) {
  if (!Number.isFinite(Number(value))) return '--';
  const number = Number(value);
  return `${(number > 1 ? number : number * 100).toFixed(1)}%`;
}
</script>
