<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header compact">
      <div>
        <p class="eyebrow">Showcase Path</p>
        <h2>一键演示路径</h2>
        <p class="subtle">按照这 8 步录屏，可以完整展示 AgriOS 农业中控屏。</p>
      </div>
    </header>
    <section class="panel showcase-list">
      <RouterLink v-for="(item, index) in steps" :key="item.path" :to="item.path" class="showcase-step">
        <span>{{ index + 1 }}</span>
        <div>
          <strong>{{ item.title }}</strong>
          <p class="subtle">{{ item.desc }}</p>
        </div>
      </RouterLink>
    </section>
  </section>
</template>

<script setup lang="ts">
import DemoHeader from '../components/common/DemoHeader.vue';
import { defaultFieldId } from '../api/mock-data';

const steps = [
  { title: '检查 Demo 状态', desc: '确认所有模块 ready', path: '/demo-status' },
  { title: '打开 Cockpit', desc: '农场驾驶舱总览', path: '/cockpit' },
  { title: '查看地图', desc: '地块、设备、无人机图层', path: '/map' },
  { title: '轮灌 / 水肥作业', desc: '作业队列与执行状态', path: '/operations' },
  { title: '无人机作业', desc: 'KML/GeoJSON/CSV 导入结果', path: '/drone-operations' },
  { title: '无人机审核', desc: '人工确认和地块绑定', path: '/drone-reviews' },
  { title: '查看报表', desc: '成本、覆盖率、产量因素', path: '/reports' },
  { title: '地块详情', desc: '单地块全生命周期数据', path: `/fields/${defaultFieldId}` }
];
</script>
