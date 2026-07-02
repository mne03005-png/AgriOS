import { BadRequestException, Injectable } from '@nestjs/common';

type Position = [number, number];

@Injectable()
export class GeojsonService {
  validatePolygon(geoJson: Record<string, any>) {
    const polygon = this.extractGeometry(geoJson);
    if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates?.[0])) {
      throw new BadRequestException('GeoJSON Polygon is required');
    }
    if (polygon.coordinates[0].length < 4) {
      throw new BadRequestException('Polygon ring must contain at least 4 points');
    }
    return true;
  }

  closePolygonIfNeeded(geoJson: Record<string, any>) {
    const cloned = JSON.parse(JSON.stringify(geoJson));
    const polygon = this.extractGeometry(cloned);
    if (!polygon?.coordinates?.[0]) return cloned;
    const ring = polygon.coordinates[0] as Position[];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      ring.push([...first]);
    }
    return cloned;
  }

  calculatePolygonArea(geoJson: Record<string, any>) {
    const polygon = this.extractGeometry(geoJson);
    const ring = polygon?.coordinates?.[0] as Position[] | undefined;
    if (!ring || ring.length < 4) return { squareMeters: 0, mu: 0 };
    const radius = 6378137;
    let area = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      area += this.toRadians(lng2 - lng1) * (2 + Math.sin(this.toRadians(lat1)) + Math.sin(this.toRadians(lat2)));
    }
    const squareMeters = Math.abs((area * radius * radius) / 2);
    return { squareMeters, mu: squareMeters / 666.6666667 };
  }

  simplifyPolygon(geoJson: Record<string, any>, tolerance = 0.00001) {
    const cloned = JSON.parse(JSON.stringify(geoJson));
    const polygon = this.extractGeometry(cloned);
    const ring = polygon?.coordinates?.[0] as Position[] | undefined;
    if (!ring || ring.length <= 5) return cloned;
    polygon.coordinates[0] = ring.filter((point, index) => index === 0 || index === ring.length - 1 || this.distance(point, ring[index - 1]) >= tolerance);
    return this.closePolygonIfNeeded(cloned);
  }

  lineStringToPolygon(trackJson: Record<string, any>) {
    const line = this.extractGeometry(trackJson);
    if (!line || line.type !== 'LineString' || !Array.isArray(line.coordinates)) {
      throw new BadRequestException('GeoJSON LineString is required');
    }
    const ring = [...line.coordinates] as Position[];
    if (ring.length < 3) throw new BadRequestException('Track must contain at least 3 points');
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }
    return { type: 'Polygon', coordinates: [ring] };
  }

  pointsToLineString(input: any) {
    if (Array.isArray(input)) {
      return {
        type: 'LineString',
        coordinates: input.map((point) => [Number(point.lng ?? point[0]), Number(point.lat ?? point[1])])
      };
    }
    const geometry = this.extractGeometry(input);
    if (geometry?.type === 'LineString') return geometry;
    throw new BadRequestException('Track must be GeoJSON LineString or point array');
  }

  private extractGeometry(geoJson: Record<string, any>) {
    if (geoJson.type === 'Feature') return geoJson.geometry;
    return geoJson;
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }

  private distance(a: Position, b: Position) {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
  }
}
