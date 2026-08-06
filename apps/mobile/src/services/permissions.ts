export type CanonicalRole = 'FARMER' | 'MANAGER' | 'INSTALLER' | 'ENGINEER' | 'SUPER_ADMIN';

const legacyMap: Record<string, CanonicalRole> = {
  FARMER: 'FARMER', OPERATOR: 'FARMER', VIEWER: 'FARMER', DRONE_PILOT: 'FARMER', MACHINERY_PROVIDER: 'FARMER', INPUT_STORE: 'FARMER',
  LARGE_GROWER: 'MANAGER', COOPERATIVE_ADMIN: 'MANAGER', TENANT_ADMIN: 'MANAGER', FARM_MANAGER: 'MANAGER',
  INSTALLER: 'INSTALLER', MAINTAINER: 'ENGINEER', PLATFORM_ADMIN: 'SUPER_ADMIN'
};

export function canonicalRole(role?: string): CanonicalRole {
  return (role && legacyMap[role]) || 'FARMER';
}

export function canAccess(allowed: CanonicalRole[] | undefined, role?: string) {
  return !allowed?.length || allowed.includes(canonicalRole(role));
}
