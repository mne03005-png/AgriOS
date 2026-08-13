<template>
  <section class="page">
    <header class="section-header">
      <div>
        <p class="eyebrow">Bluetooth</p>
        <h1>蓝牙安装维护</h1>
        <p class="subtle">蓝牙仅用于近场调试、维护和应急诊断，不能绕过 AgriOS Safety / Approval。</p>
      </div>
    </header>
    <div v-if="isMock" class="mock-banner">当前为 Bluetooth skeleton，不调用真实 BLE 协议。</div>
    <section class="panel">
      <div class="panel-title">允许操作</div>
      <p class="list-line">读取设备信息、配置设备、绑定设备、读取状态、维护检查。</p>
      <p class="warning-text">开泵、开阀、施肥等危险动作必须走后端审批链路。</p>
    </section>
    <section v-if="!items.length" class="panel">
      <div class="panel-title">暂无维护会话</div>
      <p class="subtle">安装人员或维护人员可在后端创建 session。</p>
    </section>
    <section v-for="item in items" :key="item.id" class="panel">
      <div class="card-topline">
        <strong>{{ item.sessionCode }}</strong>
        <span class="status-pill">{{ item.status }}</span>
      </div>
      <p class="subtle">deviceId={{ item.deviceId ?? '-' }} · expiresAt={{ item.expiresAt }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getBluetoothSessions } from '../api/production-api';

const items = ref<any[]>([]);
const isMock = ref(false);

onMounted(async () => {
  const result = await getBluetoothSessions();
  items.value = Array.isArray(result.data) ? result.data : [];
  isMock.value = result.isMock;
});
</script>
