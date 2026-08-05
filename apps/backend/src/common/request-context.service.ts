import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
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

  setAuthContext(context: Pick<RequestContext, 'userId' | 'farmId' | 'tenantId' | 'role'>) {
    const store = this.storage.getStore();
    if (!store) return;
    store.userId = context.userId;
    store.farmId = context.farmId;
    store.tenantId = context.tenantId;
    store.role = context.role;
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
    return this.getRole() === 'PLATFORM_ADMIN';
  }
}
