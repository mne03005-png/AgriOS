import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req: any, res: any, next: () => void) {
  const incoming = req.headers?.['x-request-id'];
  const requestId = Array.isArray(incoming) ? incoming[0] : incoming || randomUUID();
  req.requestId = requestId;
  res.setHeader?.('x-request-id', requestId);
  next();
}
