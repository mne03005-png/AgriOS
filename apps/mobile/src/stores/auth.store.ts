import { reactive } from 'vue';
import type { AuthUser } from '../api/auth-api';

const tokenKey = 'agrios_access_token';
const userKey = 'agrios_user';

function loadUser() {
  try {
    const raw = localStorage.getItem(userKey);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const authStore = reactive({
  token: localStorage.getItem(tokenKey),
  user: loadUser(),
  get isLoggedIn() {
    return Boolean(this.token);
  },
  setSession(token: string, user: AuthUser) {
    this.token = token;
    this.user = user;
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
  },
  clear() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  }
});
