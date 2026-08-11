import { RequestContextService } from './request-context.service';

export function trustedRequestContextMiddleware(requestContext: RequestContextService) {
  return (req: { requestId?: string }, _res: unknown, next: () => void) =>
    requestContext.run({ requestId: req.requestId }, next);
}
