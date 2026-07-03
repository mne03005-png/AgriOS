<template>
  <section id="home" class="hero section-full">
    <div class="hero-bg" role="img" aria-label="农业灌溉和数字化农场场景占位图"></div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <p class="eyebrow">AgriOS · 农业物联网操作系统</p>
      <h1>让每一亩土地<br />都可感知、可分析、可安全执行</h1>
      <p class="hero-subtitle">
        AgriOS 统一连接传感器、气象站、水泵、阀门、水肥机、无人机与边缘网关，为大田、果园和设施农业提供开放、安全、智能的数字化管理平台。
      </p>
      <p class="mode-note">当前演示环境采用 MOCK / DRY-RUN 模式，真实设备控制尚未开放。</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-large" href="#capabilities">了解 AgriOS</a>
        <a class="btn btn-light btn-large" :href="links.platform" target="_blank" rel="noreferrer">进入管理平台</a>
      </div>
    </div>

    <div class="data-console" aria-label="演示数据浮层">
      <div class="console-header">
        <span></span>
        <strong>Farm telemetry</strong>
        <em>MOCK / DRY-RUN</em>
      </div>
      <div class="metric-grid">
        <article v-for="metric in heroMetrics" :key="metric.label" class="metric-card">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { heroMetrics, links } from '../content/siteContent';
</script>
