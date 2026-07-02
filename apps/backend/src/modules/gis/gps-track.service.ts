import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordinateSystemCode, CoordinateTransformService } from './coordinate-transform.service';
import { ImportGpsTrackDto } from './dto/import-gps-track.dto';
import { GeojsonService } from './geojson.service';

@Injectable()
export class GpsTrackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordinateTransform: CoordinateTransformService,
    private readonly geojsonService: GeojsonService
  ) {}

  async importTrack(dto: ImportGpsTrackDto) {
    const lineString = this.geojsonService.pointsToLineString(dto.trackJson);
    const normalizedTrack = this.coordinateTransform.convertGeoJSON(lineString, dto.coordinateSystem as CoordinateSystemCode, 'WGS84');
    const gpsTrack = await (this.prisma as any).gpsTrack.create({
      data: {
        farmId: dto.farmId,
        name: dto.name,
        source: dto.source,
        coordinateSystem: 'WGS84',
        trackJson: normalizedTrack,
        rawFileName: dto.rawFileName,
        metadata: { inputCoordinateSystem: dto.coordinateSystem }
      }
    });

    let boundary = null;
    if (dto.closeLoop) {
      const polygon = this.geojsonService.lineStringToPolygon(normalizedTrack);
      const area = this.geojsonService.calculatePolygonArea(polygon);
      boundary = await (this.prisma as any).fieldBoundary.create({
        data: {
          farmId: dto.farmId,
          name: `${dto.name} 边界候选`,
          source: 'HANDHELD_GPS',
          coordinateSystem: 'WGS84',
          polygon,
          area: area.squareMeters,
          confidence: 0.7,
          status: 'CANDIDATE',
          rawInput: { gpsTrackId: gpsTrack.id, areaMu: area.mu }
        }
      });
    }

    return { gpsTrack, boundary };
  }

  findAll(query: Record<string, unknown> = {}) {
    return (this.prisma as any).gpsTrack.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
