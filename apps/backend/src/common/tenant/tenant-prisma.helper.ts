export function withTenant<T extends Record<string, unknown>>(where: T, tenantId?: string | null, isPlatformAdmin = false) {
  if (!tenantId || isPlatformAdmin) return where;
  return { ...where, tenantId };
}

export function tenantCreateData<T extends Record<string, unknown>>(data: T, tenantId?: string | null) {
  if (!tenantId || data.tenantId) return data;
  return { ...data, tenantId };
}
