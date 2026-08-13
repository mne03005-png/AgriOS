import { request } from './http';

export type Farm = { id: string; tenantId: string | null; name: string; type?: string; fields?: unknown[] };

// Wraps the existing, unmodified GET /farms/:id (apps/backend/src/modules/farm/farm.controller.ts,
// via BasicCrudController). Used only to resolve a display NAME for a farm that
// farm.store.ts's setCurrentFarm() has been corrected to via a field deep link -- never as an
// authorization source. The farm-scoped mobile endpoints (cockpit/map/alerts/...) remain the
// only authority on whether a farmId is actually usable for a given user.
export const getFarmById = (id: string) => request<Farm>(`/farms/${id}`, {}, { id, name: id, tenantId: null });

// UX-1H: wraps the existing, unmodified GET /farms list endpoint. FarmService.findAll() already
// returns every farm across every tenant for a PLATFORM_ADMIN caller (FarmService.scopeWhere()
// returns {} for platform admins) -- this is pre-existing, already-authorized backend behavior,
// not something UX-1H introduces. Used only by SuperAdminPage.vue's tenant/farm picker; each
// farm record's own tenantId is used to filter client-side by the selected tenant, since the
// backend list endpoint has no tenant-filter query parameter of its own.
export const getFarms = () => request<Farm[]>('/farms', {}, []);
