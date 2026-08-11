import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  userId?: string;
  farmId?: string;
  tenantId?: string;
  role?: string;
  requestId?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run(context: RequestContext, callback: () => void) {
    this.storage.run(context, callback);
  }

  setAuthenticatedPrincipal(context: Pick<RequestContext, 'userId' | 'farmId' | 'tenantId' | 'role'>) {
    const store = this.storage.getStore();
    if (!store) return;
    Object.assign(store, context);
  }

  setAuthorizedTenant(tenantId: string) {
    const store = this.storage.getStore();
    if (store) store.tenantId = tenantId;
  }

  getUserId() {
    return this.storage.getStore()?.userId;
  }

  getFarmId() {
    return this.storage.getStore()?.farmId;
  }

  getTenantId() {
    return this.storage.getStore()?.tenantId;
  }

  getRole() {
    return this.storage.getStore()?.role;
  }

  getRequestId() {
    return this.storage.getStore()?.requestId;
  }

  isPlatformAdmin() {
    return this.getRole() === 'PLATFORM_ADMIN' || this.getRole() === 'SUPER_ADMIN';
  }
}
