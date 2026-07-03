<template>
  <section id="about" class="section-large customer-section">
    <div class="section-inner two-column">
      <div>
        <p class="eyebrow">适用客户</p>
        <h2>服务从一块地到一个农业项目的长期运营</h2>
        <p class="section-lead">
          AgriOS 面向农业经营主体、服务团队、设备厂商和科研示范场景，帮助不同角色共享可信的农场数字底座。
        </p>
      </div>
      <div class="customer-list">
        <span v-for="customer in customers" :key="customer">{{ customer }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { customers } from '../content/siteContent';
</script>
