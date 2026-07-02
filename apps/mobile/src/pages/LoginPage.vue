<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">P12 Auth</p>
        <h1>Demo 用户登录</h1>
        <p class="subtle">登录后请求会自动携带 JWT。未登录时仍保留 Demo 模式。</p>
      </div>
    </header>

    <section class="card">
      <label class="form-row">
        <span>邮箱</span>
        <input v-model="email" placeholder="demo@agrios.local" />
      </label>
      <label class="form-row">
        <span>密码</span>
        <input v-model="password" type="password" placeholder="demo123456" />
      </label>
      <button class="primary-button" :disabled="loading" @click="submit">
        {{ loading ? '登录中...' : '登录 Demo 农场' }}
      </button>
      <button v-if="authStore.isLoggedIn" class="ghost-button" @click="logout">退出登录</button>
      <p v-if="message" class="subtle">{{ message }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import DemoHeader from '../components/common/DemoHeader.vue';
import { login } from '../api/auth-api';
import { authStore } from '../stores/auth.store';

const router = useRouter();
const email = ref('demo@agrios.local');
const password = ref('demo123456');
const loading = ref(false);
const message = ref('');

async function submit() {
  loading.value = true;
  message.value = '';
  try {
    const result = await login({ email: email.value, password: password.value });
    authStore.setSession(result.accessToken, result.user);
    message.value = `已登录：${result.user.name} / ${result.user.role}`;
    await router.push('/profile');
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function logout() {
  authStore.clear();
  message.value = '已退出，当前为 Demo 模式';
}
</script>
