import { BASE_URL } from './http';

export type AuthUser = {
  id: string;
  tenantId?: string | null;
  farmId?: string | null;
  name: string;
  phone?: string;
  email?: string | null;
  role: string;
  canonicalRole?: 'FARMER' | 'MANAGER' | 'INSTALLER' | 'ENGINEER' | 'SUPER_ADMIN';
  legacyRole?: string | null;
  effectivePermissions?: string[];
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.data ?? body;
}

export async function login(input: { email?: string; phone?: string; password: string }) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error('账号或密码错误');
  return (await readJson(response)) as AuthResponse;
}

export async function me(token: string) {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Profile failed: HTTP ${response.status}`);
  return (await readJson(response)) as { user: AuthUser; tenant: unknown; role: string };
}

export async function changePassword(token: string, input: { currentPassword: string; newPassword: string }) {
  const response = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(response.status === 401 ? '当前密码不正确或登录已过期' : `Change password failed: HTTP ${response.status}`);
  return (await readJson(response)) as AuthResponse;
}

export async function logout(token: string) {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => undefined);
}
