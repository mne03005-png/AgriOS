import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordinateSystemCode, CoordinateTransformService } from './coordinate-transform.service';
import { CreateFieldBoundaryDto } from './dto/create-field-boundary.dto';
import { CreateMapLayerDto } from './dto/create-map-layer.dto';
import { UpdateFieldBoundaryDto } from './dto/update-field-boundary.dto';
import { GeojsonService } from './geojson.service';

@Injectable()
export class GisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordinateTransform: CoordinateTransformService,
    private readonly geojsonService: GeojsonService
  ) {}

  async createFieldBoundary(dto: CreateFieldBoundaryDto) {
    const normalized = this.normalizePolygon(dto.polygon, dto.coordinateSystem as CoordinateSystemCode);
    const closed = this.geojsonService.closePolygonIfNeeded(normalized);
    this.geojsonService.validatePolygon(closed);
    const area = this.geojsonService.calculatePolygonArea(closed);
    return (this.prisma as any).fieldBoundary.create({
      data: {
        farmId: dto.farmId,
        fieldId: dto.fieldId,
        name: dto.name,
        source: dto.source,
        coordinateSystem: 'WGS84',
        polygon: closed,
        area: area.squareMeters,
        confidence: dto.confidence,
        status: 'CANDIDATE',
        rawInput: { ...dto, areaMu: area.mu }
      }
    });
  }

  findFieldBoundaries(query: Record<string, unknown> = {}) {
    return (this.prisma as any).fieldBoundary.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findFieldBoundary(id: string) {
    const item = await (this.prisma as any).fieldBoundary.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Field boundary not found');
    return item;
  }

  async updateFieldBoundary(id: string, dto: UpdateFieldBoundaryDto) {
    await this.findFieldBoundary(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.polygon) {
      const normalized = this.normalizePolygon(dto.polygon, (dto.coordinateSystem ?? 'WGS84') as CoordinateSystemCode);
      const closed = this.geojsonService.closePolygonIfNeeded(normalized);
      const area = this.geojsonService.calculatePolygonArea(closed);
      data.polygon = closed;
      data.area = area.squareMeters;
      data.coordinateSystem = 'WGS84';
      data.rawInput = { ...dto, areaMu: area.mu };
    }
    return (this.prisma as any).fieldBoundary.update({ where: { id }, data });
  }

  async approveFieldBoundary(id: string) {
    const boundary = await this.findFieldBoundary(id);
    const updated = await (this.prisma as any).fieldBoundary.update({
      where: { id },
      data: { status: 'APPROVED' }
    });
    const mapLayer = await (this.prisma as any).mapLayer.create({
      data: {
        farmId: boundary.farmId,
        name: `${boundary.name} 图层`,
        type: 'FIELD',
        source: 'FIELD_BOUNDARY_APPROVAL',
        coordinateSystem: 'WGS84',
        geoJson: boundary.polygon,
        styleJson: { stroke: '#18a058', fill: '#18a05833', boundaryId: id }
      }
    });
    return { boundary: updated, mapLayer };
  }

  async archiveFieldBoundary(id: string) {
    await this.findFieldBoundary(id);
    return (this.prisma as any).fieldBoundary.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async createMapLayer(dto: CreateMapLayerDto) {
    const normalized = this.coordinateTransform.convertGeoJSON(dto.geoJson, dto.coordinateSystem as CoordinateSystemCode, 'WGS84');
    return (this.prisma as any).mapLayer.create({
      data: {
        farmId: dto.farmId,
        name: dto.name,
        type: dto.type,
        source: dto.source,
        coordinateSystem: 'WGS84',
        geoJson: normalized,
        styleJson: dto.styleJson,
        isVisible: dto.isVisible ?? true
      }
    });
  }

  findMapLayers(query: Record<string, unknown> = {}) {
    return (this.prisma as any).mapLayer.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.type === 'string' ? { type: query.type } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async updateMapLayer(id: string, dto: Partial<CreateMapLayerDto>) {
    const existing = await (this.prisma as any).mapLayer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Map layer not found');
    const data: Record<string, unknown> = { ...dto };
    if (dto.geoJson) {
      data.geoJson = this.coordinateTransform.convertGeoJSON(dto.geoJson, (dto.coordinateSystem ?? 'WGS84') as CoordinateSystemCode, 'WGS84');
      data.coordinateSystem = 'WGS84';
    }
    return (this.prisma as any).mapLayer.update({ where: { id }, data });
  }

  convertPoint(input: { lng: number; lat: number; from: CoordinateSystemCode; to: CoordinateSystemCode }) {
    return this.coordinateTransform.convertPoint(Number(input.lng), Number(input.lat), input.from, input.to);
  }

  convertGeoJSON(input: { geoJson: Record<string, unknown>; from: CoordinateSystemCode; to: CoordinateSystemCode }) {
    return this.coordinateTransform.convertGeoJSON(input.geoJson, input.from, input.to);
  }

  private normalizePolygon(polygon: Record<string, unknown>, coordinateSystem: CoordinateSystemCode) {
    return this.coordinateTransform.convertGeoJSON(polygon, coordinateSystem, 'WGS84');
  }
}
