<template>
  <header class="site-header">
    <a class="brand" href="#home" aria-label="AgriOS 首页" @click="closeMenu">
      <span class="brand-mark" aria-hidden="true">A</span>
      <span>
        <strong>AgriOS</strong>
        <small>农业物联网操作系统</small>
      </span>
    </a>

    <button class="menu-button" type="button" :aria-expanded="isOpen" aria-label="打开导航" @click="isOpen = !isOpen">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <nav class="nav-links" :class="{ open: isOpen }" aria-label="主导航">
      <a v-for="item in navItems" :key="item.target" :href="item.target" @click="closeMenu">{{ item.label }}</a>
    </nav>

    <div class="header-actions">
      <a class="btn btn-ghost" :href="links.demo" target="_blank" rel="noreferrer">查看演示</a>
      <a class="btn btn-primary" :href="links.platform" target="_blank" rel="noreferrer">进入平台</a>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { links, navItems } from '../content/siteContent';

const isOpen = ref(false);
const closeMenu = () => {
  isOpen.value = false;
};
</script>
