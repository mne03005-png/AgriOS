import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../request-context.service';

@Injectable()
export class TenantContextService {
  constructor(private readonly requestContext: RequestContextService) {}

  getTenantId() {
    return this.requestContext.getTenantId();
  }

  getRole() {
    return this.requestContext.getRole();
  }

  isPlatformAdmin() {
    return this.requestContext.isPlatformAdmin();
  }
}
