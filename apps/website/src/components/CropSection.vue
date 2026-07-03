<template>
  <section id="scenes" class="section-large crop-section">
    <div class="section-inner">
      <p class="eyebrow">作物解决方案</p>
      <h2>从洋葱到设施果蔬，逐步沉淀作物数字模型</h2>
      <div class="crop-shell">
        <div class="crop-selector" role="tablist" aria-label="作物切换">
          <button
            v-for="(crop, index) in crops"
            :key="crop.name"
            type="button"
            :class="{ active: active === index }"
            @click="active = index"
          >
            {{ crop.name }}
          </button>
        </div>
        <article class="crop-detail">
          <span>Crop solution</span>
          <h3>{{ selected.name }}</h3>
          <p>{{ selected.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { crops } from '../content/siteContent';

const active = ref(0);
const selected = computed(() => crops[active.value]);
</script>
