import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type Position = [number, number];
type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

@Injectable()
export class DroneStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateDroneOperationStats(operation: any) {
    const coverageArea = this.areaMu(operation.coverageGeoJson);
    const flightDistanceM = this.lineDistanceM(operation.routeGeoJson);
    const fieldBoundary = operation.fieldBoundaryId ? await (this.prisma as any).fieldBoundary.findUnique({ where: { id: operation.fieldBoundaryId } }) : null;
    const fieldAreaMu = Number(fieldBoundary?.areaMu ?? (fieldBoundary?.area ? Number(fieldBoundary.area) / 666.6666667 : 0));
    const actualAreaMu = Number(operation.actualAreaMu ?? coverageArea ?? 0);
    const sprayVolumeL = Number(operation.sprayVolumeL ?? 0);
    const coverageRate = fieldAreaMu > 0 && actualAreaMu > 0 ? Number(Math.min(actualAreaMu / fieldAreaMu, 1).toFixed(4)) : operation.coverageRate ?? null;
    const missedAreaMu = fieldAreaMu > 0 ? Number(Math.max(fieldAreaMu - actualAreaMu, 0).toFixed(2)) : operation.missedAreaMu ?? null;
    const dosagePerMu = sprayVolumeL > 0 && actualAreaMu > 0 ? Number((sprayVolumeL / actualAreaMu).toFixed(3)) : operation.dosagePerMu ?? null;
    const coverageBBox = this.bbox(operation.coverageGeoJson);
    const fieldBBox = this.bbox(fieldBoundary?.polygon);
    const overlapRate = coverageBBox && fieldBBox ? this.bboxOverlapRatio(coverageBBox, fieldBBox) : operation.overlapRate ?? 0;
    return {
      actualAreaMu: actualAreaMu || operation.actualAreaMu,
      fieldAreaMu,
      flightDistanceM: flightDistanceM || operation.flightDistanceM,
      coverageRate,
      missedAreaMu,
      overlapRate,
      repeatedAreaMu: operation.repeatedAreaMu ?? 0,
      dosagePerMu,
      coverageBBox,
      fieldBBox,
      coverageCentroid: this.centroid(operation.coverageGeoJson),
      routeCentroid: this.centroid(operation.routeGeoJson),
      fieldCoverageEstimate: {
        method: 'area_ratio_plus_bbox_overlap_placeholder',
        note: 'This is not exact polygon intersection. Future stages can use turf.js, JSTS or PostGIS.'
      },
      statisticsNote: 'P11.5 uses simplified WGS84 geometry statistics; exact polygon intersection is reserved as TODO.'
    };
  }

  bbox(geoJson: any): BBox | null {
    const points = this.collectPoints(geoJson);
    if (!points.length) return null;
    return {
      minLng: Math.min(...points.map((point) => point[0])),
      minLat: Math.min(...points.map((point) => point[1])),
      maxLng: Math.max(...points.map((point) => point[0])),
      maxLat: Math.max(...points.map((point) => point[1]))
    };
  }

  centroid(geoJson: any): Position | null {
    const points = this.collectPoints(geoJson);
    if (!points.length) return null;
    return [
      Number((points.reduce((sum, point) => sum + point[0], 0) / points.length).toFixed(7)),
      Number((points.reduce((sum, point) => sum + point[1], 0) / points.length).toFixed(7))
    ];
  }

  bboxOverlapRatio(a: BBox, b: BBox) {
    const minLng = Math.max(a.minLng, b.minLng);
    const minLat = Math.max(a.minLat, b.minLat);
    const maxLng = Math.min(a.maxLng, b.maxLng);
    const maxLat = Math.min(a.maxLat, b.maxLat);
    if (maxLng <= minLng || maxLat <= minLat) return 0;
    const intersection = (maxLng - minLng) * (maxLat - minLat);
    const areaA = (a.maxLng - a.minLng) * (a.maxLat - a.minLat);
    const areaB = (b.maxLng - b.minLng) * (b.maxLat - b.minLat);
    const base = Math.min(areaA, areaB);
    return base > 0 ? Number((intersection / base).toFixed(4)) : 0;
  }

  distanceBetween(a: Position, b: Position) {
    return this.haversine(a, b);
  }

  private areaMu(geoJson: any) {
    const rings = this.extractPolygonRings(geoJson);
    if (!rings.length) return null;
    const squareMeters = rings.reduce((sum, ring) => sum + this.ringAreaSquareMeters(ring), 0);
    return Number((squareMeters / 666.6666667).toFixed(2));
  }

  private lineDistanceM(geoJson: any) {
    const lines = this.extractLines(geoJson);
    if (!lines.length) return null;
    const distance = lines.reduce((total, line) => {
      let lineDistance = 0;
      for (let i = 1; i < line.length; i += 1) lineDistance += this.haversine(line[i - 1], line[i]);
      return total + lineDistance;
    }, 0);
    return Number(distance.toFixed(2));
  }

  private extractPolygonRings(geoJson: any): Position[][] {
    const geometry = geoJson?.type === 'Feature' ? geoJson.geometry : geoJson;
    if (geometry?.type === 'Polygon') return [geometry.coordinates?.[0]].filter(Boolean);
    if (geometry?.type === 'MultiPolygon') return (geometry.coordinates ?? []).map((polygon: Position[][]) => polygon[0]).filter(Boolean);
    if (geometry?.type === 'FeatureCollection') return (geometry.features ?? []).flatMap((feature: any) => this.extractPolygonRings(feature));
    return [];
  }

  private extractLines(geoJson: any): Position[][] {
    const geometry = geoJson?.type === 'Feature' ? geoJson.geometry : geoJson;
    if (geometry?.type === 'LineString') return [geometry.coordinates ?? []];
    if (geometry?.type === 'MultiLineString') return geometry.coordinates ?? [];
    if (geometry?.type === 'FeatureCollection') return (geometry.features ?? []).flatMap((feature: any) => this.extractLines(feature));
    return [];
  }

  private collectPoints(value: any): Position[] {
    if (!value) return [];
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return [[Number(value[0]), Number(value[1])]];
    if (Array.isArray(value)) return value.flatMap((item) => this.collectPoints(item));
    if (value.type === 'Feature') return this.collectPoints(value.geometry);
    if (value.type === 'FeatureCollection') return value.features?.flatMap((feature: any) => this.collectPoints(feature)) ?? [];
    if (value.coordinates) return this.collectPoints(value.coordinates);
    return [];
  }

  private ringAreaSquareMeters(ring: Position[]) {
    if (!ring || ring.length < 4) return 0;
    const radius = 6378137;
    let area = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      area += this.toRadians(lng2 - lng1) * (2 + Math.sin(this.toRadians(lat1)) + Math.sin(this.toRadians(lat2)));
    }
    return Math.abs((area * radius * radius) / 2);
  }

  private haversine(a: Position, b: Position) {
    const radius = 6371000;
    const dLat = this.toRadians(b[1] - a[1]);
    const dLng = this.toRadians(b[0] - a[0]);
    const lat1 = this.toRadians(a[1]);
    const lat2 = this.toRadians(b[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}
