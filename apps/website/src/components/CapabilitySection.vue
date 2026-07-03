<template>
  <section id="capabilities" class="section-full capability-section">
    <div class="section-inner two-column">
      <div>
        <p class="eyebrow">AgriOS 智慧农场</p>
        <h2>一个平台，管理农场的感知、决策与执行</h2>
        <p class="section-lead">
          从地块、作物和设备档案开始，AgriOS 将农业现场的传感、判断和执行链路组织到同一个操作界面中。
        </p>
      </div>
      <div class="capability-list">
        <article v-for="item in capabilities" :key="item.title" class="feature-row">
          <span class="feature-index"></span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { capabilities } from '../content/siteContent';
</script>
