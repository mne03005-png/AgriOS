export type ApiResult<T> = { data: T; isMock: boolean; error?: string; path?: string; status?: number };

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

export async function request<T>(path: string, options: RequestInit = {}, fallback: T): Promise<ApiResult<T>> {
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
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.message ? ` ${body.message}` : '';
      } catch {
        detail = '';
      }
      const error = new Error(`${path} -> HTTP ${response.status}${detail}`);
      (error as any).status = response.status;
      throw error;
    }
    const body = await response.json();
    return { data: body.data ?? body, isMock: false };
  } catch (error) {
    return { data: fallback, isMock: true, path, status: (error as any)?.status, error: error instanceof Error ? error.message : String(error) };
  }
}
