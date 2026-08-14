import { apiRequest } from './http';
import type { FieldBoundary, GpsTrack } from '../types/domain';

// Same /gis/* endpoints apps/mobile's gis-api.ts already calls. This app does not add a new
// backend route for GPS boundary capture -- it submits to the existing importGpsTrack endpoint,
// exactly like DrawBoundaryTool/GpsBoundaryRecorder do on the Web client.
export type GpsPoint = { lng: number; lat: number; timestamp?: string };

export const getFieldBoundaries = (farmId: string) =>
  apiRequest<FieldBoundary[]>(`/gis/field-boundaries?farmId=${encodeURIComponent(farmId)}`);

export const importGpsTrack = (payload: {
  farmId: string;
  name: string;
  source: string;
  coordinateSystem: 'WGS84';
  points: GpsPoint[];
  closeLoop?: boolean;
}) =>
  apiRequest<{ gpsTrack: GpsTrack; boundary: FieldBoundary | null }>('/gis/gps-tracks/import', {
    method: 'POST',
    body: JSON.stringify({ ...payload, trackJson: payload.points })
  });
