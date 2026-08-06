export type DataSource = 'LIVE' | 'CACHE' | 'MOCK' | 'NONE';
export type DataStatus = 'LOADING' | 'LIVE' | 'STALE' | 'EMPTY' | 'OFFLINE' | 'ERROR' | 'MOCK';

export type DataEnvelope<T> = {
  data: T;
  source: DataSource;
  status: DataStatus | 401 | 403;
  lastUpdatedAt: string | null;
  freshness: 'CURRENT' | 'STALE' | 'UNKNOWN';
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  isMock: boolean;
  path?: string;
  httpStatus?: number;
  error?: string;
};

export function mockAllowed() {
  const raw = String(import.meta.env.VITE_ALLOW_MOCK_DATA ?? (import.meta.env.DEV ? 'true' : 'false')).toLowerCase();
  return import.meta.env.PROD ? false : raw === 'true';
}

export function offlineCommandReason() {
  return typeof navigator !== 'undefined' && !navigator.onLine ? '当前离线，设备命令未提交。' : null;
}
