<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">P12 Auth</p>
        <h1>AgriOS 登录</h1>
        <p class="subtle">生产环境需要登录后查看农场数据；本地演示仍可使用 Demo 账号。</p>
      </div>
    </header>

    <section class="card">
      <label class="form-row">
        <span>邮箱</span>
        <input v-model="email" placeholder="demo@agrios.local" />
      </label>
      <label class="form-row">
        <span>密码</span>
        <input v-model="password" type="password" placeholder="请输入密码" />
      </label>
      <button class="primary-button" :disabled="loading" @click="submit">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <button v-if="authStore.isLoggedIn" class="ghost-button" @click="logout">退出登录</button>
      <p v-if="message" class="subtle">{{ message }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DemoHeader from '../components/common/DemoHeader.vue';
import { login } from '../api/auth-api';
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
    message.value = `已登录：${result.user.name} / ${result.user.role}`;
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/profile';
    await router.replace(redirect);
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function logout() {
  authStore.clear();
  message.value = '已退出登录。';
}
</script>
