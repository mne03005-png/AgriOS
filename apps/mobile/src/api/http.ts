import { authStore } from '../stores/auth.store';
import type { DataEnvelope } from '../services/data-state';
import { mockAllowed } from '../services/data-state';
import { parseApiError, parseApiErrorText } from './api-error';

export type ApiResult<T> = DataEnvelope<T>;

const env = import.meta.env as Record<string, string | undefined>;

function resolveBaseUrl() {
  if (env.VITE_API_BASE_URL) return env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined' && window.location.hostname === 'agrios.xyzwtt.com') {
    return 'https://agrios-api.xyzwtt.com/api/v1';
  }
  return 'http://localhost:3000/api/v1';
}

export const BASE_URL = resolveBaseUrl();

function resolveAuthToken() {
  const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('agrios_access_token') : null;
  if (storedToken) return storedToken;
  if (import.meta.env.DEV && env.VITE_AUTH_TOKEN) return env.VITE_AUTH_TOKEN;
  return null;
}

export async function request<T>(path: string, options: RequestInit = {}, fallback?: T): Promise<ApiResult<T>> {
  if ((options.method ?? 'GET').toUpperCase() !== 'GET' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return { data: null as T, source: 'NONE', status: 'OFFLINE', lastUpdatedAt: null, freshness: 'UNKNOWN', errorCode: 'OFFLINE_COMMAND_BLOCKED', errorMessage: '当前离线，写入或设备命令未提交。', retryable: true, isMock: false, path };
  }
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const authToken = resolveAuthToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers ?? {})
      }
    });
    if (!response.ok) {
      const apiError = parseApiErrorText(response.status, await response.text());
      const error = new Error(apiError.message);
      Object.assign(error, { status: response.status, apiError });
      throw error;
    }
    const body = await response.json();
    const data = body.data ?? body;
    return { data, source: 'LIVE', status: data == null || (Array.isArray(data) && !data.length) ? 'EMPTY' : 'LIVE', lastUpdatedAt: new Date().toISOString(), freshness: 'CURRENT', errorCode: null, errorMessage: null, retryable: false, isMock: false, path };
  } catch (error) {
    if ((error as any)?.status === 401) {
      authStore.clear();
      if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
        const redirect = `${window.location.pathname}${window.location.search}`;
        const loginPath = window.location.pathname.startsWith('/mobile') ? '/mobile/login' : '/login';
        window.location.assign(`${loginPath}?redirect=${encodeURIComponent(redirect)}`);
      }
    }
    const apiError = (error as any)?.apiError ?? parseApiError({ status: (error as any)?.status, error });
    const message = apiError.message;
    if (mockAllowed() && fallback !== undefined) {
      return { data: fallback, source: 'MOCK', status: 'MOCK', lastUpdatedAt: null, freshness: 'UNKNOWN', errorCode: apiError.errorCode, errorMessage: message, retryable: true, isMock: true, path, httpStatus: apiError.statusCode, error: message, ...apiError };
    }
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return { data: null as T, source: 'NONE', status: offline ? 'OFFLINE' : 'ERROR', lastUpdatedAt: null, freshness: 'UNKNOWN', errorCode: offline ? 'NETWORK_ERROR' : apiError.errorCode, errorMessage: message, retryable: true, isMock: false, path, httpStatus: apiError.statusCode, error: message, ...apiError };
  }
}
