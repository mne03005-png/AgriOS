<template>
  <section class="page">
    <DemoHeader />
    <div v-if="isMock" class="mock-banner">Current reports are mock fallback.</div>
    <header class="section-header">
      <h1>Reports</h1>
      <p class="subtle">Operational summary, not PDF export.</p>
    </header>
    <section class="metric-grid">
      <Metric label="Today water" :value="report.dailyWaterUsage" />
      <Metric label="Month water" :value="report.monthlyWaterUsage" />
      <Metric label="Water per mu" :value="report.waterPerMu" />
      <Metric label="Online rate" :value="`${report.deviceOnlineRate ?? 0}%`" />
      <Metric label="Execution success" :value="`${report.actionExecutionSuccessRate ?? 0}%`" />
      <Metric label="AI adoption" :value="`${report.aiAdoptionRate ?? 0}%`" />
      <Metric label="Irrigation volume" :value="`${report.irrigationVolumeSummary?.quantity ?? 0} ${report.irrigationVolumeSummary?.unit ?? ''}`" />
      <Metric label="Fertigation tasks" :value="report.fertigationTaskSummary?.total ?? 0" />
      <Metric label="Pressure anomalies" :value="report.pressureAnomalyCount ?? 0" />
      <Metric label="Flow anomalies" :value="report.flowAnomalyCount ?? 0" />
      <Metric label="Rotation success" :value="`${report.rotationExecutionSuccessRate ?? 0}%`" />
      <Metric label="Drone operations" :value="report.droneOperationCount ?? 0" />
      <Metric label="Spraying area" :value="`${report.sprayingAreaTotal ?? 0} mu`" />
      <Metric label="Drone coverage" :value="`${report.averageCoverageRate ?? 0}%`" />
      <Metric label="Chemical usage" :value="`${report.chemicalUsageTotal ?? 0} L`" />
      <Metric label="Operation cost" :value="`${report.operationCostSummary?.totalAmount ?? 0} ${report.operationCostSummary?.currency ?? 'CNY'}`" />
      <Metric label="Pesticide volume" :value="`${report.pesticideUsageSummary?.sprayVolumeL ?? 0} L`" />
      <Metric label="Drone service cost" :value="`${report.droneServiceCostSummary?.totalAmount ?? 0} ${report.droneServiceCostSummary?.currency ?? 'CNY'}`" />
      <Metric label="Crop observations" :value="report.cropHealthSummary?.total ?? 0" />
      <Metric label="Yield factors" :value="report.yieldAnalysisSummary?.factorCount ?? 0" />
    </section>
    <section class="panel">
      <div class="panel-title">汇报摘要</div>
      <p>今日灌溉执行情况：轮灌、水肥和设备执行状态已汇总到移动报表。</p>
      <p>无人机喷洒覆盖情况：覆盖率 {{ report.averageCoverageRate ?? 0 }}%，作业面积 {{ report.sprayingAreaTotal ?? 0 }} mu。</p>
      <p>成本投入情况：当前记录 {{ report.operationCostSummary?.count ?? 0 }} 条成本，占位金额 {{ report.operationCostSummary?.totalAmount ?? 0 }} {{ report.operationCostSummary?.currency ?? 'CNY' }}。</p>
      <p>病虫害观察：{{ report.cropHealthSummary?.total ?? 0 }} 条观察记录。</p>
      <p>产量影响因素：{{ report.yieldAnalysisSummary?.factorCount ?? 0 }} 条因素进入后续分析。</p>
    </section>
    <section class="panel">
      <div class="panel-title">Input-output placeholders</div>
      <p class="subtle">P11.6 records cost, crop-health and yield-factor basics for later ROI analysis.</p>
      <p>Cost categories: {{ Object.keys(report.operationCostSummary?.byCategory ?? {}).join(', ') || '--' }}</p>
      <p>Yield factor types: {{ Object.keys(report.yieldAnalysisSummary?.byFactorType ?? {}).join(', ') || '--' }}</p>
    </section>
    <section v-if="!hasReportData || !demoReady" class="panel">
      <div class="panel-title">Reports data not ready</div>
      <p class="warning-text">请先执行 npx prisma db seed，生成成本、作物健康、产量因素和作业报告。</p>
      <RouterLink class="ghost-button link-button" to="/demo-status">查看 Demo 状态</RouterLink>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { getDemoHealth } from '../api/demo-api';
import { getReportsSummary } from '../api/mobile-api';
import { defaultFarmId, mockReports } from '../api/mock-data';
import DemoHeader from '../components/common/DemoHeader.vue';

const report = ref<any>(mockReports);
const isMock = ref(true);
const demoReady = ref(true);
const hasReportData = computed(() => Boolean((report.value.droneOperationCount ?? 0) || (report.value.operationCostSummary?.count ?? 0) || (report.value.yieldAnalysisSummary?.factorCount ?? 0)));

const Metric = defineComponent({
  props: { label: { type: String, required: true }, value: { type: [String, Number], required: true } },
  setup(props) {
    return () => h('div', { class: 'metric-card' }, [h('span', props.label), h('strong', String(props.value))]);
  }
});

onMounted(async () => {
  const [result, health] = await Promise.all([getReportsSummary(defaultFarmId), getDemoHealth(defaultFarmId)]);
  report.value = result.data;
  isMock.value = result.isMock;
  demoReady.value = Boolean(health.data?.isReady) || health.isMock;
});
</script>
