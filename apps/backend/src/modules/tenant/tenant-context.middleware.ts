import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: any, _res: unknown, next: () => void) {
    const headerValue = req.headers?.['x-tenant-id'];
    req.tenantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    next();
  }
}
