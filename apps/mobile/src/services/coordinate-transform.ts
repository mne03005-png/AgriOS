// WGS84 <-> GCJ-02 coordinate conversion.
//
// Why this exists: AgriOS stores field/boundary geometry as WGS84 (see
// FieldBoundary.coordinateSystem in the Prisma schema, default 'WGS84' -- real GPS/drone capture
// naturally produces WGS84). AMap (and Baidu, and all Chinese mainland map services) render on
// GCJ-02 ("Mars Coordinates"), a deliberately offset datum required by Chinese surveying law for
// any publicly served map of mainland China. Passing raw WGS84 coordinates into AMap renders
// points 50-600m away from their true location -- a silent, easy-to-miss correctness bug, not a
// cosmetic one, since a farm's real field boundary would appear to sit in the wrong spot.
//
// Conversion responsibility: every AMapAdapter method that receives coordinates from AgriOS's own
// stores (which are WGS84) MUST call wgs84ToGcj02 before handing them to the AMap SDK. Values
// already coming from AMap's own APIs (e.g. a click event) are already GCJ-02 and must be
// converted the other way (gcj02ToWgs84) before being handed back to AgriOS/onMapClick callers,
// so everything outside this adapter file continues to see WGS84 consistently, matching every
// other adapter (Mock/Baidu/Google) and the database's own coordinateSystem contract.
//
// This is the standard, widely-published GCJ-02 offset algorithm (China's officially mandated
// non-secret transform formula, not a proprietary AMap/Baidu algorithm) -- the same public-domain
// math used by essentially every open-source WGS84/GCJ-02 conversion utility.

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number } {
  if (outOfChina(lng, lat)) return { lng, lat };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lng: lng + dLng, lat: lat + dLat };
}

export function gcj02ToWgs84(lng: number, lat: number): { lng: number; lat: number } {
  if (outOfChina(lng, lat)) return { lng, lat };
  const gcj = wgs84ToGcj02(lng, lat);
  const dLng = gcj.lng - lng;
  const dLat = gcj.lat - lat;
  return { lng: lng - dLng, lat: lat - dLat };
}
