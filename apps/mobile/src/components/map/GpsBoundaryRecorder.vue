<template>
  <section class="panel">
    <div class="card-topline">
      <strong>GPS 走边界</strong>
      <span>{{ points.length }} 点 · {{ distanceText }}</span>
    </div>
    <input v-model="name" class="text-input" placeholder="轨迹名称，例如 洋葱地A GPS边界" />
    <p class="subtle">{{ message }}</p>
    <div class="button-row">
      <button class="primary-button" :disabled="recording" @click="start">开始记录</button>
      <button class="secondary-button" :disabled="!recording" @click="stop">停止</button>
      <button class="primary-button" :disabled="points.length < 3 || !name" @click="$emit('submit', name)">生成候选边界</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

const props = defineProps<{ points: Array<{ lng: number; lat: number; timestamp?: string }>; recording: boolean }>();
const emit = defineEmits<{ start: []; stop: []; submit: [name: string] }>();
const name = ref('');
const message = ref('浏览器定位可用时，每隔数秒记录一个点。');
let watchId: number | null = null;

const distanceText = computed(() => `${estimateDistance(props.points).toFixed(0)}m`);

function start() {
  if (!navigator.geolocation) {
    message.value = '当前浏览器不支持 geolocation。';
    return;
  }
  emit('start');
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      window.dispatchEvent(
        new CustomEvent('agrios:gps-point', {
          detail: { lng: position.coords.longitude, lat: position.coords.latitude, timestamp: new Date().toISOString() }
        })
      );
    },
    (error) => {
      message.value = `定位失败：${error.message}`;
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function stop() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  emit('stop');
}

function estimateDistance(points: Array<{ lng: number; lat: number }>) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.sqrt((points[i].lng - points[i - 1].lng) ** 2 + (points[i].lat - points[i - 1].lat) ** 2) * 111000;
  }
  return total;
}

onBeforeUnmount(stop);
</script>
