import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as authApi from '../api/auth-api';
import { getStoredToken, setStoredToken } from '../api/http';
import type { AuthUser } from '../types/domain';

const USER_KEY = 'agrios_user';

type AuthState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  token: string | null;
  user: AuthUser | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (input: { phone?: string; email?: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  token: null,
  user: null,
  error: null,

  // Restores a previously issued session from SecureStore on cold start. Never embeds or
  // fabricates a token -- if nothing was stored, the user lands on the login screen.
  async bootstrap() {
    const token = await getStoredToken();
    if (!token) {
      set({ status: 'signed-out', token: null, user: null });
      return;
    }
    const rawUser = await SecureStore.getItemAsync(USER_KEY);
    const cachedUser = rawUser ? (JSON.parse(rawUser) as AuthUser) : null;
    set({ status: 'signed-in', token, user: cachedUser });
    // Re-validate against the backend in the background; an expired/revoked token must not
    // leave the user silently stuck on stale cached data.
    try {
      const profile = await authApi.me();
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profile.user));
      set({ user: profile.user });
    } catch {
      await setStoredToken(null);
      await SecureStore.deleteItemAsync(USER_KEY);
      set({ status: 'signed-out', token: null, user: null });
    }
  },

  async login(input) {
    set({ error: null });
    try {
      const response = await authApi.login(input);
      await setStoredToken(response.accessToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
      set({ status: 'signed-in', token: response.accessToken, user: response.user });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '登录失败，请稍后重试' });
      return false;
    }
  },

  async logout() {
    const token = get().token;
    if (token) await authApi.logout();
    await setStoredToken(null);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ status: 'signed-out', token: null, user: null });
  }
}));
