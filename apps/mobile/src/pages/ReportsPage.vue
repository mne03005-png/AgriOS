<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前为模拟数据。</div>
    <header class="section-header">
      <h1>报表</h1>
      <p class="subtle">运营数据汇总，暂不支持 PDF 导出。</p>
    </header>
    <section class="metric-grid">
      <Metric label="今日用水" :value="report.dailyWaterUsage" />
      <Metric label="本月用水" :value="report.monthlyWaterUsage" />
      <Metric label="亩均用水" :value="report.waterPerMu" />
      <Metric label="设备在线率" :value="`${report.deviceOnlineRate ?? 0}%`" />
      <Metric label="执行成功率" :value="`${report.actionExecutionSuccessRate ?? 0}%`" />
      <Metric label="AI 采纳率" :value="`${report.aiAdoptionRate ?? 0}%`" />
      <Metric label="灌溉水量" :value="`${report.irrigationVolumeSummary?.quantity ?? 0} ${report.irrigationVolumeSummary?.unit ?? ''}`" />
      <Metric label="水肥任务数" :value="report.fertigationTaskSummary?.total ?? 0" />
      <Metric label="压力异常" :value="report.pressureAnomalyCount ?? 0" />
      <Metric label="流量异常" :value="report.flowAnomalyCount ?? 0" />
      <Metric label="轮灌成功率" :value="`${report.rotationExecutionSuccessRate ?? 0}%`" />
      <Metric label="无人机作业数" :value="report.droneOperationCount ?? 0" />
      <Metric label="喷洒面积" :value="`${report.sprayingAreaTotal ?? 0} 亩`" />
      <Metric label="无人机覆盖率" :value="`${report.averageCoverageRate ?? 0}%`" />
      <Metric label="药剂用量" :value="`${report.chemicalUsageTotal ?? 0} L`" />
      <Metric label="作业成本" :value="`${report.operationCostSummary?.totalAmount ?? 0} ${report.operationCostSummary?.currency ?? 'CNY'}`" />
      <Metric label="农药用量" :value="`${report.pesticideUsageSummary?.sprayVolumeL ?? 0} L`" />
      <Metric label="无人机服务成本" :value="`${report.droneServiceCostSummary?.totalAmount ?? 0} ${report.droneServiceCostSummary?.currency ?? 'CNY'}`" />
      <Metric label="作物观察记录" :value="report.cropHealthSummary?.total ?? 0" />
      <Metric label="产量因素" :value="report.yieldAnalysisSummary?.factorCount ?? 0" />
    </section>
    <section class="panel">
      <div class="panel-title">汇报摘要</div>
      <p>今日灌溉执行情况：轮灌、水肥和设备执行状态已汇总到移动报表。</p>
      <p>无人机喷洒覆盖情况：覆盖率 {{ report.averageCoverageRate ?? 0 }}%，作业面积 {{ report.sprayingAreaTotal ?? 0 }} 亩。</p>
      <p>成本投入情况：当前记录 {{ report.operationCostSummary?.count ?? 0 }} 条成本，占位金额 {{ report.operationCostSummary?.totalAmount ?? 0 }} {{ report.operationCostSummary?.currency ?? 'CNY' }}。</p>
      <p>病虫害观察：{{ report.cropHealthSummary?.total ?? 0 }} 条观察记录。</p>
      <p>产量影响因素：{{ report.yieldAnalysisSummary?.factorCount ?? 0 }} 条因素进入后续分析。</p>
    </section>
    <section class="panel">
      <div class="panel-title">投入产出占位数据</div>
      <p class="subtle">记录成本、作物健康与产量因素基础数据，供后续投入产出分析使用。</p>
      <p>成本类别：{{ Object.keys(report.operationCostSummary?.byCategory ?? {}).join(', ') || '--' }}</p>
      <p>产量因素类型：{{ Object.keys(report.yieldAnalysisSummary?.byFactorType ?? {}).join(', ') || '--' }}</p>
    </section>
    <section v-if="!hasReportData || !demoReady" class="panel">
      <div class="panel-title">暂无可用报表数据</div>
      <p class="warning-text">请稍后刷新，或联系管理员确认作业和成本数据是否已生成。</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { getDemoHealth } from '../api/demo-api';
import { getReportsSummary } from '../api/mobile-api';
import { defaultFarmId, mockReports } from '../api/mock-data';

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
