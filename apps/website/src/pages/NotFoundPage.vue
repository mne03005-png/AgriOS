<template>
  <SiteHeader />
  <main class="not-found-page">
    <section class="not-found-panel">
      <p class="eyebrow">404</p>
      <h1>这片地块暂时还没有接入</h1>
      <p>你访问的页面不存在，返回首页继续了解 AgriOS。</p>
      <RouterLink class="btn btn-primary" to="/">返回首页</RouterLink>
    </section>
  </main>
  <SiteFooter />
</template>

<script setup lang="ts">
import SiteHeader from '../components/SiteHeader.vue';
import SiteFooter from '../components/SiteFooter.vue';
</script>
