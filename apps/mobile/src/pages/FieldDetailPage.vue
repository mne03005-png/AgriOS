<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">当前为模拟地块数据</div>
    <header class="section-header">
      <div>
        <p class="eyebrow">Field Detail</p>
        <h1>{{ detail.field?.name }}</h1>
        <p class="subtle">{{ detail.cropType ?? '--' }} · {{ detail.cropStage ?? '--' }} · {{ detail.soilType ?? '--' }}</p>
      </div>
    </header>

    <section class="panel">
      <div class="panel-title">地块基础信息</div>
      <p class="subtle">单地块全生命周期：作物、土壤、湿度、灌溉设计、轮灌水肥、无人机、成本、健康和产量因素。</p>
    </section>

    <section class="metric-grid">
      <Metric label="面积" :value="`${detail.field?.areaMu ?? '-'} mu`" />
      <Metric label="湿度" :value="detail.latestMoisture?.value ?? '-'" />
      <Metric label="阀门" :value="detail.valveStatus?.length ?? 0" />
      <Metric label="传感器" :value="detail.sensorStatus?.length ?? 0" />
      <Metric label="无人机作业" :value="detail.droneOperationRecords?.length ?? 0" />
      <Metric label="待审作业" :value="detail.droneOperationReviews?.length ?? 0" />
      <Metric label="作业成本" :value="`${detail.operationCostSummary?.totalAmount ?? 0} ${detail.operationCostSummary?.currency ?? 'CNY'}`" />
      <Metric label="产量因素" :value="detail.yieldFactors?.length ?? 0" />
    </section>

    <section class="panel">
      <div class="panel-title">湿度趋势</div>
      <p class="subtle">最近湿度：{{ detail.latestMoisture?.value ?? '--' }}。趋势点：{{ detail.moistureTrend?.join(' / ') || '等待传感器数据' }}</p>
    </section>

    <DecisionExplanationCard :item="detail.aiRecommendation ?? {}" />

    <section class="panel">
      <div class="panel-title">灌溉处方与模拟</div>
      <p>目标湿度 {{ detail.cropIrrigationRecipe?.targetMoistureMin ?? '-' }} - {{ detail.cropIrrigationRecipe?.targetMoistureMax ?? '-' }}</p>
      <p>深渗风险 {{ detail.wettingSimulationPreview?.deepPercolationRisk ?? '-' }}</p>
      <p>最新设计 {{ detail.latestDesign?.name ?? '暂无' }}</p>
      <p>水力校核 {{ detail.latestHydraulicCheck?.isPassed ? '通过' : '待校核' }}</p>
    </section>

    <section class="panel">
      <div class="panel-title">无人机作业记录</div>
      <p v-for="item in detail.droneOperationRecords ?? []" :key="item.id" class="list-line">
        {{ item.operationType }} · {{ item.sourceFileName ?? item.id }} · {{ percent(item.coverageRate) }}
      </p>
      <p v-if="!(detail.droneOperationRecords ?? []).length" class="subtle">暂无无人机作业记录</p>
    </section>

    <section class="panel">
      <div class="panel-title">病虫害 / 巡田观察</div>
      <p v-for="item in detail.cropHealthObservations ?? []" :key="item.id" class="list-line">
        {{ item.type }} · {{ item.severity ?? 'UNSPECIFIED' }} · {{ item.title }}
      </p>
      <p v-if="!(detail.cropHealthObservations ?? []).length" class="subtle">暂无观察记录</p>
    </section>

    <section class="panel">
      <div class="panel-title">最新作业报告</div>
      <RouterLink v-for="item in detail.latestOperationReports ?? []" :key="item.id" class="list-line link-line" :to="`/operation-reports/${item.id}`">
        {{ item.type }} · {{ item.title }}
      </RouterLink>
      <p v-if="!(detail.latestOperationReports ?? []).length" class="subtle">暂无报告</p>
    </section>

    <ValveControlPanel @command="onValve" />
  </section>
</template>

<script setup lang="ts">
import { defineComponent, h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { controlValve, getFieldDetail } from '../api/mobile-api';
import { defaultFieldId, mockFieldDetail } from '../api/mock-data';
import DecisionExplanationCard from '../components/ai/DecisionExplanationCard.vue';
import DemoHeader from '../components/common/DemoHeader.vue';
import ValveControlPanel from '../components/control/ValveControlPanel.vue';

const route = useRoute();
const detail = ref<any>(mockFieldDetail);
const isMock = ref(true);

const Metric = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number], required: true } },
  setup(props) {
    return () => h('div', { class: 'metric-card' }, [h('span', props.label), h('strong', String(props.value))]);
  }
});

onMounted(async () => {
  const result = await getFieldDetail(String(route.params.fieldId ?? defaultFieldId));
  detail.value = result.data;
  isMock.value = result.isMock;
});

async function onValve(command: 'VALVE_OPEN' | 'VALVE_CLOSE') {
  await controlValve({ deviceId: 'valve_001', command, remark: 'field detail manual valve' });
  window.alert('阀门请求已提交。');
}

function percent(value?: number) {
  if (!Number.isFinite(Number(value))) return '--';
  const number = Number(value);
  return `${(number > 1 ? number : number * 100).toFixed(1)}%`;
}
</script>
