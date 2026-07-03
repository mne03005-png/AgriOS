<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Auth</p>
        <h1>AgriOS 登录</h1>
        <p class="subtle">生产环境必须登录后查看农场数据。</p>
      </div>
    </header>

    <section class="card">
      <label class="form-row">
        <span>邮箱</span>
        <input v-model="email" autocomplete="username" placeholder="demo@agrios.local" />
      </label>
      <label class="form-row">
        <span>密码</span>
        <input v-model="password" autocomplete="current-password" type="password" placeholder="请输入密码" @keyup.enter="submit" />
      </label>
      <button class="primary-button" :disabled="loading" @click="submit">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <button v-if="authStore.isLoggedIn" class="ghost-button" @click="logoutCurrent">退出登录</button>
      <p v-if="message" class="warning-text">{{ message }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DemoHeader from '../components/common/DemoHeader.vue';
import { login, logout } from '../api/auth-api';
import { authStore } from '../stores/auth.store';

const router = useRouter();
const route = useRoute();
const email = ref('demo@agrios.local');
const password = ref('');
const loading = ref(false);
const message = ref('');

async function submit() {
  loading.value = true;
  message.value = '';
  try {
    const result = await login({ email: email.value, password: password.value });
    authStore.setSession(result.accessToken, result.user);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/profile';
    await router.replace(redirect);
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

async function logoutCurrent() {
  const token = authStore.token;
  authStore.clear();
  if (token) await logout(token);
  message.value = '已退出登录。';
}
</script>
