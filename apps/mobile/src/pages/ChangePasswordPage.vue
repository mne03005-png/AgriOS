<template>
  <section class="page">
    <DemoHeader />
    <header class="section-header">
      <div>
        <p class="eyebrow">Security</p>
        <h1>修改密码</h1>
        <p class="subtle">修改成功后会刷新登录令牌，旧令牌自动失效。</p>
      </div>
    </header>

    <section class="card">
      <label class="form-row">
        <span>当前密码</span>
        <input v-model="currentPassword" autocomplete="current-password" type="password" />
      </label>
      <label class="form-row">
        <span>新密码</span>
        <input v-model="newPassword" autocomplete="new-password" type="password" />
      </label>
      <label class="form-row">
        <span>确认新密码</span>
        <input v-model="confirmPassword" autocomplete="new-password" type="password" />
      </label>
      <button class="primary-button" :disabled="loading" @click="submit">
        {{ loading ? '提交中...' : '确认修改' }}
      </button>
      <p v-if="message" :class="messageType === 'error' ? 'warning-text' : 'subtle'">{{ message }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import DemoHeader from '../components/common/DemoHeader.vue';
import { changePassword } from '../api/auth-api';
import { authStore } from '../stores/auth.store';

const router = useRouter();
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const message = ref('');
const messageType = ref<'info' | 'error'>('info');

async function submit() {
  message.value = '';
  if (!authStore.token) {
    await router.replace('/login?redirect=/change-password');
    return;
  }
  if (newPassword.value.length < 8) {
    messageType.value = 'error';
    message.value = '新密码至少 8 位。';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    messageType.value = 'error';
    message.value = '两次输入的新密码不一致。';
    return;
  }

  loading.value = true;
  try {
    const result = await changePassword(authStore.token, {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    });
    authStore.setSession(result.accessToken, result.user);
    messageType.value = 'info';
    message.value = '密码已修改。';
    await router.replace('/profile');
  } catch (error) {
    messageType.value = 'error';
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}
</script>
