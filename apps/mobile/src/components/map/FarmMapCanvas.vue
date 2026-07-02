<template>
  <section class="farm-map-canvas">
    <svg viewBox="0 0 360 520" role="img" aria-label="AgriOS demo farm map">
      <defs>
        <linearGradient id="mapBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#0f172a" />
          <stop offset="1" stop-color="#14532d" />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="360" height="520" rx="18" fill="url(#mapBg)" />
      <path d="M24 420 C110 310 160 315 334 128" stroke="#38bdf8" stroke-width="14" opacity=".3" fill="none" />
      <path d="M20 456 C120 350 178 342 336 170" stroke="#7dd3fc" stroke-width="2" stroke-dasharray="8 8" opacity=".8" fill="none" />
      <g opacity=".22">
        <path v-for="i in 9" :key="i" :d="`M${20 + i * 35} 20 L${i * 12} 500`" stroke="#d1fae5" />
        <path v-for="i in 12" :key="`h-${i}`" :d="`M12 ${30 + i * 38} L348 ${12 + i * 24}`" stroke="#d1fae5" />
      </g>
      <g v-for="(field, index) in fields" :key="field.id ?? index" @click="$emit('select-field', field)" filter="url(#softGlow)">
        <polygon
          :points="index % 2 === 0 ? '44,78 178,58 202,212 62,232' : '184,236 318,214 332,382 202,406'"
          :fill="index % 2 === 0 ? '#22c55e' : '#84cc16'"
          opacity=".78"
          stroke="#dcfce7"
          stroke-width="3"
        />
        <text :x="index % 2 === 0 ? 78 : 220" :y="index % 2 === 0 ? 146 : 312" fill="#fff" font-size="17" font-weight="800">{{ field.name ?? '地块' }}</text>
      </g>
      <polyline points="54,96 168,112 78,154 188,184 76,212" stroke="#a855f7" stroke-width="4" fill="none" stroke-dasharray="10 8" />
      <polygon points="58,88 184,72 194,204 68,218" fill="#22c55e" opacity=".2" stroke="#bbf7d0" stroke-width="2" />
      <circle v-for="(item, index) in sensors" :key="item.id ?? index" :cx="88 + index * 42" cy="256" r="8" fill="#38bdf8" stroke="#e0f2fe" stroke-width="3" />
      <rect v-for="(item, index) in valves" :key="item.id ?? index" :x="226 + index * 30" y="168" width="18" height="18" rx="5" fill="#f97316" stroke="#ffedd5" stroke-width="3" />
      <text x="24" y="34" fill="#d1fae5" font-size="13" font-weight="800">FIELD · DEVICE · DRONE LAYERS</text>
      <text x="24" y="494" fill="#bae6fd" font-size="12">Mock map cockpit fallback</text>
    </svg>
  </section>
</template>

<script setup lang="ts">
defineProps<{ fields: any[]; sensors: any[]; valves: any[] }>();
defineEmits<{ 'select-field': [field: any] }>();
</script>
