import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class QueryFilterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request?.tenantId ?? request?.headers?.['x-tenant-id'];
    if (tenantId) {
      request.tenantFilter = { tenantId: Array.isArray(tenantId) ? tenantId[0] : tenantId };
    }
    return next.handle();
  }
}
