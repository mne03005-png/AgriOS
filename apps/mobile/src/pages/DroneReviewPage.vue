<template>
  <section class="page">
    <div v-if="isMock" class="mock-banner">当前显示的是模拟审核数据，接入真实作业数据后将自动切换。</div>
    <header class="section-header compact">
      <div>
        <h2>无人机作业审核台</h2>
        <p class="subtle">人工确认地块、覆盖区、漏喷区、重喷区和作业结果。</p>
      </div>
      <select v-model="status" @change="load">
        <option value="">全部</option>
        <option value="PENDING">待审核</option>
        <option value="NEEDS_MANUAL_LINK">需要人工关联</option>
        <option value="NEEDS_BOUNDARY_FIX">需要修正边界</option>
        <option value="APPROVED">已批准</option>
        <option value="REJECTED">已拒绝</option>
      </select>
    </header>

    <section class="panel">
      <div class="panel-title">审核逻辑</div>
      <p class="subtle">AgriOS 不自动控制无人机。无人机导入结果先进入审核台，由人工确认后再进入成本、报告、产量因素链路。</p>
    </section>

    <article v-for="item in reviews" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.operation?.sourceFileName ?? item.droneOperationId }}</strong>
        <span class="status-pill">{{ translateStatusLabel(item.status) }}</span>
      </div>
      <p class="subtle">{{ item.operation?.source }} · {{ item.operation?.droneModel ?? '未知机型' }} · {{ translateStatusLabel(item.operation?.operationType) }}</p>
      <div class="metric-grid tight">
        <div class="metric-card"><span>地块</span><strong>{{ item.correctedFieldId ?? item.operation?.fieldId ?? '--' }}</strong></div>
        <div class="metric-card"><span>面积</span><strong>{{ format(item.confirmedAreaMu ?? item.operation?.actualAreaMu) }} mu</strong></div>
        <div class="metric-card"><span>覆盖率</span><strong>{{ percent(item.confirmedCoverageRate ?? item.operation?.coverageRate) }}</strong></div>
        <div class="metric-card"><span>漏喷</span><strong>{{ format(item.confirmedMissedAreaMu ?? item.operation?.missedAreaMu) }} mu</strong></div>
        <div class="metric-card"><span>重喷</span><strong>{{ format(item.confirmedRepeatedAreaMu ?? item.operation?.repeatedAreaMu) }} mu</strong></div>
      </div>
      <p v-if="item.status === 'NEEDS_MANUAL_LINK'" class="warning-text">需要人工绑定地块</p>
      <p v-if="item.status === 'NEEDS_BOUNDARY_FIX'" class="warning-text">覆盖率偏低，建议核查覆盖区</p>
      <div class="button-row">
        <button class="icon-button" type="button" @click="approve(item)">批准</button>
        <button class="ghost-button" type="button" @click="reject(item)">拒绝</button>
        <button class="ghost-button" type="button" @click="linkField(item)">绑定地块</button>
        <RouterLink class="ghost-button link-button" :to="`/operation-reports/${item.operation?.latestReportId ?? 'report_drone_001'}`">查看报告</RouterLink>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { defaultFarmId, defaultFieldId } from '../api/mock-data';
import { approveDroneReview, getDroneReviews, linkDroneReviewField, rejectDroneReview } from '../api/drone-review-api';
import { translateStatusLabel } from '../services/status-translation';

const reviews = ref<any[]>([]);
const status = ref('');
const isMock = ref(true);

onMounted(load);

async function load() {
  const result = await getDroneReviews(defaultFarmId, status.value || undefined);
  reviews.value = result.data;
  isMock.value = result.isMock;
}

async function approve(item: any) {
  await approveDroneReview(item.droneOperationId, { reviewNote: 'mobile approved' });
  await load();
}

async function reject(item: any) {
  await rejectDroneReview(item.droneOperationId, { reviewNote: 'mobile rejected' });
  await load();
}

async function linkField(item: any) {
  await linkDroneReviewField(item.droneOperationId, { fieldId: item.correctedFieldId ?? defaultFieldId, reviewNote: 'mobile field link' });
  await load();
}

function format(value?: number) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '--';
}

function percent(value?: number) {
  if (!Number.isFinite(Number(value))) return '--';
  const number = Number(value);
  return `${(number > 1 ? number : number * 100).toFixed(1)}%`;
}
</script>
