import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class QueryFilterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request?.authorizedTenantId ?? request?.user?.tenantId;
    if (tenantId) {
      request.tenantFilter = { tenantId };
    }
    return next.handle();
  }
}
