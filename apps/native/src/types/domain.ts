// Shapes mirror the real Prisma models this app reads (apps/backend/prisma/schema.prisma) and
// the response shapes MobileService.map()/cockpit() already return -- see apps/mobile/src/api
// for the Web client consuming the same endpoints. No fields here are invented.

export type AuthUser = {
  id: string;
  tenantId?: string | null;
  farmId?: string | null;
  farm?: { id: string; name: string } | null;
  name: string;
  phone?: string;
  email?: string | null;
  role: string;
  canonicalRole?: 'FARMER' | 'MANAGER' | 'INSTALLER' | 'ENGINEER' | 'SUPER_ADMIN';
  legacyRole?: string | null;
  effectivePermissions?: string[];
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export type GeoJsonGeometry = {
  type: 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString';
  coordinates: unknown;
};

export type FieldBoundary = {
  id: string;
  farmId: string;
  fieldId?: string | null;
  name: string;
  source: string;
  coordinateSystem: 'WGS84' | 'GCJ02' | 'BD09';
  polygon: GeoJsonGeometry | { type: 'Feature'; geometry: GeoJsonGeometry };
  areaMu?: number | null;
  status: 'CANDIDATE' | 'APPROVED' | 'ARCHIVED';
};

export type MapLayer = {
  id: string;
  farmId: string;
  name: string;
  type: 'FIELD' | 'OBSTACLE' | 'WATER' | 'ROAD' | 'PIPELINE' | 'DEVICE' | 'DRONE_ROUTE' | 'IRRIGATION_ZONE' | 'ORTHOMOSAIC';
  source: string;
  coordinateSystem: 'WGS84' | 'GCJ02' | 'BD09';
  geoJson: GeoJsonGeometry | { type: 'Feature'; geometry: GeoJsonGeometry };
  styleJson?: Record<string, unknown> | null;
};

export type DeviceMarker = {
  id: string;
  name: string;
  type: string;
  online: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  field?: { id: string; name: string } | null;
};

export type GpsTrack = {
  id: string;
  farmId: string;
  name: string;
  source: string;
  coordinateSystem: 'WGS84' | 'GCJ02' | 'BD09';
  trackJson: GeoJsonGeometry;
};

export type DroneOperation = {
  id: string;
  farmId: string;
  fieldId?: string | null;
  operationType: string;
  status: string;
};

export type MobileMapData = {
  fieldBoundaries: FieldBoundary[];
  irrigationZones: MapLayer[];
  valveMarkers: DeviceMarker[];
  sensorMarkers: DeviceMarker[];
  pumpMarkers: DeviceMarker[];
  waterChannels: MapLayer[];
  pipelines: MapLayer[];
  obstacles: MapLayer[];
  droneRoutes: MapLayer[];
  droneRouteLayers: MapLayer[];
  droneCoverageLayers: MapLayer[];
  orthomosaicLayers: MapLayer[];
  droneOperations: DroneOperation[];
  gpsTracks: GpsTrack[];
};

export type Field = {
  id: string;
  farmId: string;
  name: string;
  areaMu: number | string;
  cropSeasons?: Array<{ cropName: string }>;
};
