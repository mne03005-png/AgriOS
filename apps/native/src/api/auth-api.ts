import { apiRequest } from './http';
import type { AuthResponse, AuthUser } from '../types/domain';

// Reuses the exact same /auth/* endpoints as apps/mobile's auth-api.ts -- no second auth
// system, no separate token/permission model.
export function login(input: { phone?: string; email?: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function me() {
  return apiRequest<{ user: AuthUser; tenant: unknown; role: string }>('/auth/me');
}

export function logout() {
  return apiRequest<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
}
