export type ApiResult<T> = { data: T; isMock: boolean; error?: string; path?: string; status?: number };

const env = import.meta.env as Record<string, string | undefined>;
export const BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function request<T>(path: string, options: RequestInit = {}, fallback: T): Promise<ApiResult<T>> {
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('agrios_access_token') : null;
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : env.VITE_AUTH_TOKEN ? { Authorization: `Bearer ${env.VITE_AUTH_TOKEN}` } : {}),
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
