<template>
  <section class="page">
    <header class="section-header">
      <div>
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
import { login, logout } from '../api/auth-api';
import { authStore } from '../stores/auth.store';
import { resolveLandingRoute } from '../services/role-navigation';

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
    // Priority: an explicit, internal redirect/deep-link target beats the role's default
    // landing. Falls back to the canonical role's default workspace only when there is no
    // legitimate explicit destination (see services/role-navigation.ts).
    const destination = resolveLandingRoute(result.user.canonicalRole ?? result.user.role, route.query.redirect);
    await router.replace(destination);
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
