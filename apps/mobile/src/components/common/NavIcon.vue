<template>
  <svg class="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- home: 首页 -->
    <template v-if="name === 'home'">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </template>
    <!-- field/map: 田块 -->
    <template v-else-if="name === 'field'">
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </template>
    <!-- task/check: 作业 -->
    <template v-else-if="name === 'task'">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6v2H9z" />
      <path d="m8.5 12.5 2 2 4-4.5" />
    </template>
    <!-- alert/bell: 告警 -->
    <template v-else-if="name === 'alert'">
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </template>
    <!-- chart/data: 数据 -->
    <template v-else-if="name === 'chart'">
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
    </template>
    <!-- user/profile: 我的 -->
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </template>
    <!-- workspace/manager: 管理工作台 -->
    <template v-else-if="name === 'workspace'">
      <rect x="4" y="8" width="16" height="11" rx="1.5" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
    </template>
    <!-- installer/tools: 安装任务 -->
    <template v-else-if="name === 'tools'">
      <path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L5 16v3h3l4.9-4.9a3.5 3.5 0 0 1 4.6-4.6L14.5 6.5Z" />
    </template>
    <!-- engineer/settings: 工程师工作台 -->
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
    </template>
    <!-- platform/admin: 平台管理 -->
    <template v-else-if="name === 'platform'">
      <path d="M12 3.5 4 7v3c0 5 3.4 8.7 8 10.5 4.6-1.8 8-5.5 8-10.5V7l-8-3.5Z" />
    </template>
  </svg>
</template>

<script setup lang="ts">
// UX-HOTFIX: navigation icons are drawn here, not spelled out as a second Chinese character
// (config/navigation.ts previously set icon:'警' for label:'告警' etc., rendering as duplicated
// pseudo-icon-text like "警 告警" -- see PROD-USABILITY-1). One coherent outline-stroke set,
// authored directly, so no external icon dependency is needed for ten simple glyphs.
defineProps<{
  name: 'home' | 'field' | 'task' | 'alert' | 'chart' | 'user' | 'workspace' | 'tools' | 'settings' | 'platform';
}>();
</script>
