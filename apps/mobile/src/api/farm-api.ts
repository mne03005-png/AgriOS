import { request } from './http';

// Wraps the existing, unmodified GET /farms/:id (apps/backend/src/modules/farm/farm.controller.ts,
// via BasicCrudController). Used only to resolve a display NAME for a farm that
// farm.store.ts's setCurrentFarm() has been corrected to via a field deep link -- never as an
// authorization source. The farm-scoped mobile endpoints (cockpit/map/alerts/...) remain the
// only authority on whether a farmId is actually usable for a given user.
export const getFarmById = (id: string) => request(`/farms/${id}`, {}, { id, name: id, tenantId: null });
