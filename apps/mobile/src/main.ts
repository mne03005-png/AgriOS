import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/theme.css';
import './styles/mobile.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
}

createApp(App).use(router).mount('#app');
