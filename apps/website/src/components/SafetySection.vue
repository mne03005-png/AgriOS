<template>
  <section id="support" class="section-full safety-section">
    <div class="section-inner">
      <p class="eyebrow">安全控制体系</p>
      <h2>每一次设备控制，都必须经过安全验证</h2>
      <div class="safety-badges">
        <span>MOCK</span>
        <span>DRY-RUN</span>
        <span>真实控制关闭</span>
        <span>自动执行关闭</span>
      </div>
      <div class="safety-flow">
        <span v-for="step in safetySteps" :key="step">{{ step }}</span>
      </div>
      <p class="safety-note">
        当前官网仅展示安全控制流程，不提供真实设备控制入口。实际生产控制开放前，需要完成权限、租户、设备、遥测、现场反馈和审计链路的完整验收。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { safetySteps } from '../content/siteContent';
</script>
