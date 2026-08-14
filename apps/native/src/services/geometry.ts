import type { LatLng } from 'react-native-maps';

// Ported from apps/mobile/src/pages/MapPage.vue's polygonCoordinates()/lineCoordinates() --
// same GeoJSON ring-extraction logic, retargeted from {lng,lat} (the Web map-adapter shape) to
// react-native-maps' {latitude,longitude} LatLng. GeoJSON coordinates are always [lng, lat];
// no coordinate-system conversion happens here -- see coordinate.ts for why Apple Maps needs none.

type GeoJsonLike = { type?: string; coordinates?: unknown } | { type: 'Feature'; geometry: { type?: string; coordinates?: unknown } };

function unwrapGeometry(geoJson: unknown): { type?: string; coordinates?: unknown } | null {
  if (!geoJson || typeof geoJson !== 'object') return null;
  const value = geoJson as GeoJsonLike;
  if ('type' in value && value.type === 'Feature' && 'geometry' in value) return value.geometry ?? null;
  return value as { type?: string; coordinates?: unknown };
}

export function polygonCoordinates(geoJson: unknown): LatLng[] | null {
  const geometry = unwrapGeometry(geoJson);
  if (!geometry) return null;
  const ring =
    geometry.type === 'Polygon'
      ? (geometry.coordinates as number[][][])?.[0]
      : geometry.type === 'MultiPolygon'
        ? (geometry.coordinates as number[][][][])?.[0]?.[0]
        : geometry.type === 'LineString'
          ? (geometry.coordinates as number[][])
          : geometry.type === 'MultiLineString'
            ? (geometry.coordinates as number[][][])?.[0]
            : null;
  if (!Array.isArray(ring)) return null;
  return ring
    .filter((point): point is number[] => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => ({ longitude: Number(point[0]), latitude: Number(point[1]) }));
}

export const lineCoordinates = polygonCoordinates;

export function polygonCenter(coordinates: LatLng[]): LatLng | null {
  if (coordinates.length < 3) return null;
  const latitude = coordinates.reduce((sum, point) => sum + point.latitude, 0) / coordinates.length;
  const longitude = coordinates.reduce((sum, point) => sum + point.longitude, 0) / coordinates.length;
  return { latitude, longitude };
}

export function boundsForCoordinates(coordinatesList: LatLng[][]): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  const all = coordinatesList.flat();
  if (!all.length) return null;
  const latitudes = all.map((point) => point.latitude);
  const longitudes = all.map((point) => point.longitude);
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes)
  };
}
