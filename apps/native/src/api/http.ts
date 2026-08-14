import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/env';

export const TOKEN_KEY = 'agrios_access_token';

let cachedToken: string | null | undefined; // undefined = not loaded yet from SecureStore

export async function getStoredToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

export async function setStoredToken(token: string | null) {
  cachedToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message ?? parsed?.error ?? message;
    } catch {
      if (text) message = text;
    }
    if (response.status === 401) await setStoredToken(null);
    throw new ApiError(response.status, message);
  }
  const body = await response.json();
  return (body?.data ?? body) as T;
}
