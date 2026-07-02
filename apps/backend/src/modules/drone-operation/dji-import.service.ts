import { BadRequestException, Injectable } from '@nestjs/common';
import { CoordinateSystemCode, CoordinateTransformService } from '../gis/coordinate-transform.service';
import { ImportDroneOperationDto } from './dto/import-drone-operation.dto';

type ParsedDronePayload = {
  parser: string;
  routeGeoJson?: Record<string, unknown>;
  coverageGeoJson?: Record<string, unknown>;
  prescriptionJson?: Record<string, unknown>;
  rawProperties?: Record<string, unknown>;
  warnings: string[];
};

@Injectable()
export class DjiImportService {
  constructor(private readonly coordinateTransform: CoordinateTransformService) {}

  parseImportPayload(payload: ImportDroneOperationDto) {
    const coordinateSystem = (payload.coordinateSystem ?? 'WGS84') as CoordinateSystemCode;
    const parsed = this.parseByType(payload);
    return {
      routeGeoJson: this.normalizeGeoJson(parsed.routeGeoJson ?? payload.routeGeoJson, coordinateSystem),
      coverageGeoJson: this.normalizeGeoJson(parsed.coverageGeoJson ?? payload.coverageGeoJson, coordinateSystem),
      prescriptionJson: parsed.prescriptionJson ?? payload.prescriptionJson,
      rawJson: {
        ...(payload.rawJson ?? {}),
        properties: parsed.rawProperties,
        parser: parsed.parser,
        source: payload.source,
        fileType: payload.fileType,
        fileName: payload.fileName,
        warnings: parsed.warnings
      },
      warnings: parsed.warnings
    };
  }

  parseTextFile(input: {
    farmId: string;
    fieldId?: string;
    source: string;
    fileName: string;
    fileType: string;
    operationType: string;
    coordinateSystem?: string;
    droneModel?: string;
    chemicalName?: string;
    sprayVolumeL?: number;
    rawText?: string;
    rawJson?: Record<string, unknown>;
  }) {
    return this.parseImportPayload(input as ImportDroneOperationDto);
  }

  private parseByType(payload: ImportDroneOperationDto): ParsedDronePayload {
    switch (payload.fileType) {
      case 'KML':
        return this.parseKml(payload.rawText);
      case 'GEOJSON':
      case 'MANUAL_IMPORT':
        return this.parseGeoJson(payload.rawJson ?? payload.coverageGeoJson ?? payload.routeGeoJson);
      case 'CSV':
        return this.parseCsv(payload.rawText);
      case 'GEOTIFF':
        return {
          parser: 'GEOTIFF_METADATA_ONLY',
          prescriptionJson: { type: 'GEOTIFF_METADATA', fileName: payload.fileName, note: 'GeoTIFF raster analysis is not implemented yet.' },
          warnings: ['GeoTIFF raster analysis is not implemented in P11.5.']
        };
      case 'KMZ':
        return { parser: 'KMZ_TODO', warnings: ['KMZ extraction not implemented yet.'] };
      case 'FLIGHT_RECORD_ZIP':
        return { parser: 'FLIGHT_RECORD_ZIP_STORED_ONLY', warnings: ['DJI private FlightRecord zip parsing is not implemented in P11.5.'] };
      default:
        return {
          parser: 'DIRECT_PAYLOAD',
          routeGeoJson: payload.routeGeoJson,
          coverageGeoJson: payload.coverageGeoJson,
          prescriptionJson: payload.prescriptionJson,
          warnings: []
        };
    }
  }

  private parseGeoJson(value: unknown): ParsedDronePayload {
    if (!value || typeof value !== 'object') {
      return { parser: 'GEOJSON_EMPTY', warnings: ['GeoJSON payload is empty.'] };
    }
    const geoJson = value as Record<string, any>;
    const features = this.toFeatures(geoJson);
    const lines = features.map((feature: any) => feature.geometry).filter((geometry: any) => ['LineString', 'MultiLineString'].includes(geometry?.type));
    const polygons = features.map((feature: any) => feature.geometry).filter((geometry: any) => ['Polygon', 'MultiPolygon'].includes(geometry?.type));
    const properties = features.map((feature: any) => feature.properties).filter(Boolean);
    if (lines.length === 0 && polygons.length === 0) throw new BadRequestException('GeoJSON LineString or Polygon geometry is required');
    return {
      parser: 'GEOJSON_FEATURE_AWARE',
      routeGeoJson: this.combineLines(lines),
      coverageGeoJson: this.combinePolygons(polygons),
      rawProperties: { featureCount: features.length, properties },
      warnings: []
    };
  }

  private parseKml(rawText?: string): ParsedDronePayload {
    if (!rawText) return { parser: 'KML_EMPTY', warnings: ['KML rawText is empty.'] };
    const lineStrings = this.extractKmlGeometries(rawText, 'LineString').map((block) => this.coordinatesFromKml(block)).filter((item) => item.length >= 2);
    const polygons = this.extractKmlGeometries(rawText, 'Polygon').map((block) => this.coordinatesFromKml(block)).filter((item) => item.length >= 4);
    const fallback = lineStrings.length || polygons.length ? [] : [...rawText.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)].map((match) => this.parseCoordinateText(match[1]));
    const routeLines = lineStrings.length ? lineStrings : fallback.filter((item) => item.length >= 2 && !this.isClosed(item));
    const polygonRings = polygons.length ? polygons : fallback.filter((item) => item.length >= 4 && this.isClosed(item));
    return {
      parser: 'KML_LIGHTWEIGHT',
      routeGeoJson: this.combineLines(routeLines.map((coordinates) => ({ type: 'LineString', coordinates }))),
      coverageGeoJson: this.combinePolygons(polygonRings.map((coordinates) => ({ type: 'Polygon', coordinates: [this.closeRing(coordinates)] }))),
      warnings: ['KML parser uses lightweight tag/coordinate extraction.']
    };
  }

  private parseCsv(rawText?: string): ParsedDronePayload {
    if (!rawText) return { parser: 'CSV_EMPTY', warnings: ['CSV rawText is empty.'] };
    const rows = rawText.split(/\r?\n/).filter((line) => line.trim());
    const headers = rows.shift()?.split(',').map((item) => item.trim()) ?? [];
    const lngIndex = this.firstIndex(headers, ['lng', 'longitude', 'lon']);
    const latIndex = this.firstIndex(headers, ['lat', 'latitude']);
    if (lngIndex < 0 || latIndex < 0) {
      return { parser: 'CSV_FIELD_MAPPING_FAILED', warnings: ['CSV must contain lng/lat, longitude/latitude or lon/lat columns.'] };
    }
    const coordinates = rows
      .map((line) => line.split(',').map((item) => item.trim()))
      .map((cells) => [Number(cells[lngIndex]), Number(cells[latIndex])])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const summary = this.summarizeCsv(headers, rows);
    return {
      parser: 'CSV_ROUTE',
      routeGeoJson: coordinates.length >= 2 ? { type: 'LineString', coordinates } : undefined,
      rawProperties: { headers, summary },
      warnings: coordinates.length >= 2 ? [] : ['CSV did not contain enough valid points for a route.']
    };
  }

  private toFeatures(geoJson: Record<string, any>) {
    if (geoJson.type === 'FeatureCollection') return geoJson.features ?? [];
    if (geoJson.type === 'Feature') return [geoJson];
    return [{ type: 'Feature', geometry: geoJson, properties: {} }];
  }

  private combineLines(lines: any[]) {
    if (!lines.length) return undefined;
    if (lines.length === 1) return lines[0];
    return { type: 'MultiLineString', coordinates: lines.flatMap((line) => (line.type === 'MultiLineString' ? line.coordinates : [line.coordinates])) };
  }

  private combinePolygons(polygons: any[]) {
    if (!polygons.length) return undefined;
    if (polygons.length === 1) return polygons[0];
    return { type: 'MultiPolygon', coordinates: polygons.flatMap((polygon) => (polygon.type === 'MultiPolygon' ? polygon.coordinates : [polygon.coordinates])) };
  }

  private extractKmlGeometries(rawText: string, tag: 'LineString' | 'Polygon') {
    return [...rawText.matchAll(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi'))].map((match) => match[0]);
  }

  private coordinatesFromKml(block: string) {
    const match = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    return match ? this.parseCoordinateText(match[1]) : [];
  }

  private parseCoordinateText(text: string) {
    return text
      .trim()
      .split(/\s+/)
      .map((item) => item.split(',').map(Number))
      .filter((item) => Number.isFinite(item[0]) && Number.isFinite(item[1]))
      .map((item) => [item[0], item[1]]);
  }

  private closeRing(coordinates: number[][]) {
    if (this.isClosed(coordinates)) return coordinates;
    return [...coordinates, [...coordinates[0]]];
  }

  private isClosed(coordinates: number[][]) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    return Boolean(first && last && first[0] === last[0] && first[1] === last[1]);
  }

  private firstIndex(headers: string[], names: string[]) {
    return headers.findIndex((header) => names.includes(header.toLowerCase()));
  }

  private summarizeCsv(headers: string[], rows: string[]) {
    const fields = ['flow', 'speed', 'height', 'sprayVolume'];
    const summary: Record<string, { min: number; max: number; avg: number } | null> = {};
    for (const field of fields) {
      const index = headers.findIndex((header) => header.toLowerCase() === field.toLowerCase());
      if (index < 0) continue;
      const values = rows.map((line) => Number(line.split(',')[index])).filter((value) => Number.isFinite(value));
      summary[field] = values.length
        ? { min: Math.min(...values), max: Math.max(...values), avg: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) }
        : null;
    }
    return summary;
  }

  private normalizeGeoJson(geoJson: Record<string, unknown> | undefined, from: CoordinateSystemCode) {
    if (!geoJson) return undefined;
    return this.coordinateTransform.convertGeoJSON(geoJson, from, 'WGS84');
  }
}
