import { randomUUID } from 'node:crypto';

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function normalizeRequestId(value: unknown) {
  const requestId = Array.isArray(value) ? value[0] : value;
  if (typeof requestId === 'string' && requestIdPattern.test(requestId)) return requestId;
  return randomUUID();
}

export function requestIdMiddleware(req: any, res: any, next: () => void) {
  const requestId = normalizeRequestId(req.headers?.['x-request-id']);
  req.requestId = requestId;
  res.setHeader?.('x-request-id', requestId);
  next();
}
