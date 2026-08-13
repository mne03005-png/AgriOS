import { request } from './http';

// Wraps existing, unmodified GET /tenants and GET /tenants/:id
// (apps/backend/src/modules/tenant/tenant.controller.ts), gated by
// @Permissions(TENANT_MANAGE, PLATFORM_CONTEXT) -- SUPER_ADMIN already holds both via the
// existing permission matrix. No backend change, no new endpoint, no x-platform-context header
// needed (TenantGuard's isPlatformRole branch passes for a platform role with no explicit
// cross-tenant tenantId/farmId query supplied).
export type Tenant = { id: string; name: string; type?: string; status?: string };

export const getTenants = () => request<Tenant[]>('/tenants', {}, []);
export const getTenantById = (id: string) => request<Tenant>(`/tenants/${id}`, {}, { id, name: id });
