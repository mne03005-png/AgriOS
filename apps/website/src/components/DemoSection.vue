<template>
  <section class="section-large demo-section">
    <div class="section-inner">
      <p class="eyebrow">演示方案</p>
      <h2>先看得见，再一步步接入真实农业现场</h2>
      <div class="demo-grid">
        <article v-for="demo in demos" :key="demo.title">
          <h3>{{ demo.title }}</h3>
          <p>{{ demo.text }}</p>
        </article>
      </div>
      <div class="final-cta">
        <h2>从一块地开始，建立属于你的智慧农场</h2>
        <div>
          <a class="btn btn-primary btn-large" :href="links.demo" target="_blank" rel="noreferrer">查看演示</a>
          <a class="btn btn-light btn-large" :href="links.platform" target="_blank" rel="noreferrer">进入 AgriOS</a>
          <a class="btn btn-ghost btn-large" href="mailto:business@example.com">商务合作</a>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { demos, links } from '../content/siteContent';
</script>
