<template>
  <section id="products" class="section-large product-section">
    <div class="section-inner">
      <p class="eyebrow">产品矩阵</p>
      <h2>从农场管理到边缘执行的完整数字底座</h2>
      <div class="product-grid">
        <article v-for="product in products" :key="product.name" class="product-item">
          <div class="product-icon" aria-hidden="true">{{ product.name.replace('AgriOS ', '').slice(0, 2) }}</div>
          <h3>{{ product.name }}</h3>
          <p>{{ product.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { products } from '../content/siteContent';
</script>
