<template>
  <section id="solutions" class="section-full solution-section">
    <div class="section-inner">
      <p class="eyebrow">区域解决方案</p>
      <h2>不同气候、不同作物，都需要可落地的农业数字化方案</h2>
      <div class="solution-layout">
        <button
          v-for="(solution, index) in regionalSolutions"
          :key="solution.name"
          class="solution-tab"
          :class="{ active: active === index }"
          type="button"
          @click="active = index"
        >
          {{ solution.name }}
        </button>
        <article class="solution-detail">
          <h3>{{ current.name }}</h3>
          <dl>
            <div><dt>主要痛点</dt><dd>{{ current.pain }}</dd></div>
            <div><dt>推荐设备</dt><dd>{{ current.devices }}</dd></div>
            <div><dt>主要功能</dt><dd>{{ current.features }}</dd></div>
            <div><dt>适合作物</dt><dd>{{ current.crops }}</dd></div>
          </dl>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { regionalSolutions } from '../content/siteContent';

const active = ref(0);
const current = computed(() => regionalSolutions[active.value]);
</script>
