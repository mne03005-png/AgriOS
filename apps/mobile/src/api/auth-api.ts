import { BASE_URL } from './http';

export type AuthUser = {
  id: string;
  tenantId?: string | null;
  farmId?: string | null;
  name: string;
  phone?: string;
  email?: string | null;
  role: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export async function login(input: { email?: string; phone?: string; password: string }) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(`Login failed: HTTP ${response.status}`);
  const body = await response.json();
  return (body.data ?? body) as AuthResponse;
}

export async function me(token: string) {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Profile failed: HTTP ${response.status}`);
  const body = await response.json();
  return (body.data ?? body) as { user: AuthUser; tenant: unknown; role: string };
}
