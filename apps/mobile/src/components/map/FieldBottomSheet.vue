<template>
  <section v-if="field" class="bottom-sheet">
    <div>
      <p class="eyebrow">Field Boundary</p>
      <h2>{{ field.name ?? '地块详情' }}</h2>
      <p class="subtle">面积 {{ field.areaMu ?? field.area ?? '-' }} 亩 · 来源 {{ field.source ?? '-' }} · {{ field.status ?? '正常' }}</p>
      <p class="subtle">作物 {{ field.cropType ?? '-' }} · 湿度 {{ field.moisture ?? '-' }} · AI {{ field.recommendation ?? '-' }}</p>
    </div>
    <div class="button-row">
      <RouterLink class="primary-button" :to="`/fields/${field.fieldId ?? field.id ?? 'field_001'}`">进入详情</RouterLink>
      <button class="secondary-button" @click="confirm('立即灌溉')">立即灌溉</button>
      <button class="secondary-button">灌溉设计</button>
      <button class="secondary-button">生成航线</button>
      <RouterLink v-if="canReviewBoundaries" class="secondary-button" to="/boundaries/review">边界审核</RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { authStore } from '../../stores/auth.store';
import { canAccess } from '../../services/permissions';

defineProps<{ field: any | null }>();

// UX-1E section 11: this link must match /boundaries/review's own route meta
// (MANAGER/INSTALLER/ENGINEER/SUPER_ADMIN) -- FARMER previously saw it despite being unable
// to open the page.
const canReviewBoundaries = computed(() => canAccess(['MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN'], authStore.user?.canonicalRole ?? authStore.user?.role));

function confirm(label: string) {
  window.confirm(`${label} 属于危险操作，提交后仍由后端安全策略最终控制。`);
}
</script>
