import type { CanonicalRole } from './permissions';

export type PlatformMode = 'PLATFORM' | 'FARM_OPERATION' | null;

// UX-1H single source of truth for "is SUPER_ADMIN currently in Platform Mode or Farm Operation
// Mode." Deliberately a PURE function, not a store -- mode is not new state to persist or leak
// across sessions/users, it is a direct projection of two things that already exist and are
// already correctly scoped: the current role, and farmStore's own currentFarmId (UX-1D's single
// canonical farm-operation-context source, already userId-scoped and already cleared on logout-
// adjacent flows). Returns null for every role other than SUPER_ADMIN -- the platform/farm mode
// distinction only exists for SUPER_ADMIN; FARMER/MANAGER/INSTALLER/ENGINEER are unaffected and
// must never consult this.
export function getPlatformMode(role: CanonicalRole, currentFarmId: string | null): PlatformMode {
  if (role !== 'SUPER_ADMIN') return null;
  return currentFarmId ? 'FARM_OPERATION' : 'PLATFORM';
}
