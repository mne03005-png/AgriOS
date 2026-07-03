import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from './jwt-auth.guard';

export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user?.tenantId;
});
