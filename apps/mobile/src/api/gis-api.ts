import { request } from './http';
import { defaultFarmId, mockMap } from './mock-data';

export type FieldBoundaryPayload = {
  farmId: string;
  name: string;
  source: string;
  coordinateSystem: 'WGS84' | 'GCJ02' | 'BD09';
  polygon: Record<string, unknown>;
  fieldId?: string;
  confidence?: number;
};

export const createFieldBoundary = (payload: FieldBoundaryPayload) =>
  request('/gis/field-boundaries', { method: 'POST', body: JSON.stringify(payload) }, { id: `local_${Date.now()}`, ...payload, status: 'CANDIDATE' });

export const getFieldBoundaries = (farmId = defaultFarmId, status?: string) =>
  request(`/gis/field-boundaries?farmId=${farmId}${status ? `&status=${status}` : ''}`, {}, mockMap.fieldBoundaries);

export const approveFieldBoundary = (id: string) =>
  request(`/gis/field-boundaries/${id}/approve`, { method: 'POST' }, { boundary: { id, status: 'APPROVED' }, mapLayer: { id: `layer_${id}`, type: 'FIELD' } });

export const archiveFieldBoundary = (id: string) =>
  request(`/gis/field-boundaries/${id}/archive`, { method: 'POST' }, { id, status: 'ARCHIVED' });

export const importGpsTrack = (payload: { farmId: string; name: string; source: string; coordinateSystem: string; points?: any[]; trackJson?: any; closeLoop?: boolean }) =>
  request(
    '/gis/gps-tracks/import',
    { method: 'POST', body: JSON.stringify({ ...payload, trackJson: payload.trackJson ?? payload.points ?? [] }) },
    { gpsTrack: { id: `track_${Date.now()}`, ...payload }, boundary: payload.closeLoop ? { id: `boundary_${Date.now()}`, status: 'CANDIDATE' } : null }
  );

export const getGpsTracks = (farmId = defaultFarmId) => request(`/gis/gps-tracks?farmId=${farmId}`, {}, mockMap.gpsTracks);

export const getMapLayers = (farmId = defaultFarmId) => request(`/gis/map-layers?farmId=${farmId}`, {}, [...mockMap.orthomosaicLayers, ...mockMap.irrigationZones]);

export const createMapLayer = (payload: Record<string, unknown>) =>
  request('/gis/map-layers', { method: 'POST', body: JSON.stringify(payload) }, { id: `layer_${Date.now()}`, ...payload });

export const convertCoordinate = (payload: Record<string, unknown>) =>
  request('/gis/coordinate/convert', { method: 'POST', body: JSON.stringify(payload) }, payload);
