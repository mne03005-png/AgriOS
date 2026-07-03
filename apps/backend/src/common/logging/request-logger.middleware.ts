import { limitText, redactSensitive } from './sensitive-redaction';

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
  user?: {
    userId?: string;
    tenantId?: string;
    farmId?: string;
  };
}

interface ResponseLike {
  statusCode?: number;
  on(event: 'finish', listener: () => void): void;
}

function pickHeader(headers: RequestLike['headers'], key: string) {
  const value = headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function trustedClientIp(req: RequestLike) {
  const forwardedFor = pickHeader(req.headers, 'x-forwarded-for');
  const firstForwarded = forwardedFor?.split(',')[0]?.trim();
  return firstForwarded || req.ip || undefined;
}

export function requestLoggerMiddleware(req: RequestLike, res: ResponseLike, next: () => void) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const event = redactSensitive({
      timestamp: new Date().toISOString(),
      eventType: 'http.request',
      requestId: req.requestId,
      method: req.method,
      route: req.originalUrl ?? req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.userId ?? null,
      tenantId: req.user?.tenantId ?? null,
      farmId: req.user?.farmId ?? null,
      ip: trustedClientIp(req),
      userAgent: limitText(pickHeader(req.headers, 'user-agent'), 160)
    });
    console.log(JSON.stringify(event));
  });
  next();
}
