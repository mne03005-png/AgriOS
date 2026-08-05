import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: any, _res: unknown, next: () => void) {
    next();
  }
}
