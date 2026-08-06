import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'production' && env.VITE_ALLOW_MOCK_DATA?.toLowerCase() === 'true') {
    throw new Error('Production builds cannot enable VITE_ALLOW_MOCK_DATA');
  }
  return {
  base: env.VITE_BASE_PATH ?? '/',
  plugins: [vue()],
  server: {
    port: 5174
  }
  };
});
