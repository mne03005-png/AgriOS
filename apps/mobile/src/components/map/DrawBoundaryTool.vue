<template>
  <section class="panel">
    <div class="card-topline">
      <strong>手动画地块</strong>
      <span>{{ points.length }} 点</span>
    </div>
    <input v-model="name" class="text-input" placeholder="边界名称，例如 洋葱地A边界" />
    <p class="subtle">点击地图添加点，至少 3 个点后可闭合保存。</p>
    <p>预估面积：{{ areaMu.toFixed(2) }} 亩</p>
    <div class="button-row">
      <button class="primary-button" @click="$emit('start')">开始绘制</button>
      <button class="secondary-button" @click="$emit('stop')">停止</button>
      <button class="primary-button" :disabled="points.length < 3 || !name" @click="save">保存候选</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{ points: Array<{ lng: number; lat: number }> }>();
const emit = defineEmits<{ start: []; stop: []; save: [name: string] }>();
const name = ref('');

const areaMu = computed(() => {
  if (props.points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < props.points.length; i += 1) {
    const current = props.points[i];
    const next = props.points[(i + 1) % props.points.length];
    sum += current.lng * next.lat - next.lng * current.lat;
  }
  return Math.abs(sum) * 1000000 / 666.67;
});

function save() {
  emit('save', name.value);
}
</script>
