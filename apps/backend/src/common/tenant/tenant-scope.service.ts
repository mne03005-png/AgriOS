import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '../request-context.service';

@Injectable()
export class TenantScopeService {
  constructor(private readonly requestContext: RequestContextService) {}

  isPlatformAdmin() {
    return this.requestContext.isPlatformAdmin();
  }

  requireTenantId() {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId && !this.isPlatformAdmin()) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  where<T extends Record<string, unknown>>(base: T = {} as T): T & { tenantId?: string } {
    if (this.isPlatformAdmin()) return base;
    return { ...base, tenantId: this.requireTenantId() };
  }

  createData<T extends Record<string, unknown>>(dto: T): T & { tenantId?: string } {
    const { tenantId: _tenantId, ...safeDto } = dto as any;
    if (this.isPlatformAdmin()) return safeDto;
    return { ...safeDto, tenantId: this.requireTenantId() };
  }

  async assertExists<T>(query: Promise<T | null>, message: string) {
    const item = await query;
    if (!item) throw new NotFoundException(message);
    return item;
  }
}
