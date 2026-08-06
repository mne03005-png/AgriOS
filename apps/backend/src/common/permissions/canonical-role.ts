import { PermissionKey } from './permission.constants';
import { PERMISSION_MATRIX } from './permission-matrix';

export const CANONICAL_ROLES = ['FARMER', 'MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN'] as const;
export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, CanonicalRole> = {
  FARMER: 'FARMER',
  LARGE_GROWER: 'MANAGER',
  COOPERATIVE_ADMIN: 'MANAGER',
  TENANT_ADMIN: 'MANAGER',
  FARM_MANAGER: 'MANAGER',
  OPERATOR: 'FARMER',
  VIEWER: 'FARMER',
  INSTALLER: 'INSTALLER',
  MAINTAINER: 'ENGINEER',
  PLATFORM_ADMIN: 'SUPER_ADMIN',
  DRONE_PILOT: 'FARMER',
  MACHINERY_PROVIDER: 'FARMER',
  INPUT_STORE: 'FARMER'
};

export function canonicalRoleFor(legacyRole?: string): CanonicalRole {
  return (legacyRole && LEGACY_ROLE_MAP[legacyRole]) || 'FARMER';
}

export function effectivePermissionsFor(legacyRole?: string): PermissionKey[] {
  return legacyRole ? [...(PERMISSION_MATRIX[legacyRole] ?? [])] : [];
}

export function roleIdentity(legacyRole?: string) {
  return {
    canonicalRole: canonicalRoleFor(legacyRole),
    legacyRole: legacyRole ?? null,
    effectivePermissions: effectivePermissionsFor(legacyRole)
  };
}
