<template>
  <article class="decision-card">
    <div class="card-topline">
      <strong>{{ translateStatusLabel(item.recommendation ?? 'NO_ACTION') }}</strong>
      <RiskBadge :level="item.riskLevel ?? item.status ?? 'NORMAL'" />
    </div>
    <p>{{ item.reason ?? item.reasons?.[0] ?? '暂无解释' }}</p>
    <div class="metric-grid compact">
      <span>置信度 {{ percent(item.confidenceScore ?? item.confidence ?? 0.7) }}</span>
      <span>预计增湿 {{ item.expectedMoistureIncrease ?? '-' }}</span>
      <span>预计用水 {{ item.expectedWaterUsage ?? '-' }}</span>
    </div>
    <div v-if="item.approvalRequired" class="approval-note">需要审批，不能直接执行</div>
  </article>
</template>

<script setup lang="ts">
import RiskBadge from './RiskBadge.vue';
import { translateStatusLabel } from '../../services/status-translation';

defineProps<{ item: any }>();
const percent = (value: number) => `${Math.round(Number(value) * 100)}%`;
</script>
