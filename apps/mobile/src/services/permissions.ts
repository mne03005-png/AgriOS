export type CanonicalRole = 'FARMER' | 'MANAGER' | 'INSTALLER' | 'ENGINEER' | 'SUPER_ADMIN';

const canonicalRoles: readonly CanonicalRole[] = ['FARMER', 'MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN'];

const legacyMap: Record<string, CanonicalRole> = {
  FARMER: 'FARMER', OPERATOR: 'FARMER', VIEWER: 'FARMER', DRONE_PILOT: 'FARMER', MACHINERY_PROVIDER: 'FARMER', INPUT_STORE: 'FARMER',
  LARGE_GROWER: 'MANAGER', COOPERATIVE_ADMIN: 'MANAGER', TENANT_ADMIN: 'MANAGER', FARM_MANAGER: 'MANAGER',
  INSTALLER: 'INSTALLER', MAINTAINER: 'ENGINEER', PLATFORM_ADMIN: 'SUPER_ADMIN'
};

// Idempotent: canonicalRole(canonicalRole(x)) === canonicalRole(x) for every input. Only
// FARMER/INSTALLER previously survived a double-wrap unchanged (they happen to be both a
// legacy value and a canonical value); MANAGER/ENGINEER/SUPER_ADMIN silently collapsed back
// to FARMER, which broke canAccess() call sites (e.g. App.vue's desktop nav filter) that
// pre-resolve a canonical role before passing it to a second canAccess()/canonicalRole()
// call. Checking the canonical set first makes every call site safe regardless of whether
// it passes a raw legacy role or an already-canonical one.
export function canonicalRole(role?: string): CanonicalRole {
  if (role && (canonicalRoles as readonly string[]).includes(role)) return role as CanonicalRole;
  return (role && legacyMap[role]) || 'FARMER';
}

export function canAccess(allowed: CanonicalRole[] | undefined, role?: string) {
  return !allowed?.length || allowed.includes(canonicalRole(role));
}
