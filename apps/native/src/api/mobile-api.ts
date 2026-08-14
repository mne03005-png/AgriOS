import { apiRequest } from './http';
import type { MobileMapData } from '../types/domain';

// Same read-only /mobile/* endpoints apps/mobile's mobile-api.ts already calls -- one backend,
// one API surface, shared between the Vue Web client and this native client.
export const getMap = (farmId: string) => apiRequest<MobileMapData>(`/mobile/map?farmId=${encodeURIComponent(farmId)}`);

export const getCockpit = (farmId: string) => apiRequest<Record<string, unknown>>(`/mobile/cockpit?farmId=${encodeURIComponent(farmId)}`);

export const getOperations = (farmId: string) => apiRequest<Record<string, unknown>>(`/mobile/operations?farmId=${encodeURIComponent(farmId)}`);

export const getAlerts = (farmId: string) => apiRequest<Record<string, unknown>>(`/mobile/alerts?farmId=${encodeURIComponent(farmId)}`);
