import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordinateSystemCode, CoordinateTransformService } from './coordinate-transform.service';
import { RunBoundaryRecognitionDto } from './dto/run-boundary-recognition.dto';
import { GeojsonService } from './geojson.service';

@Injectable()
export class BoundaryRecognitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordinateTransform: CoordinateTransformService,
    private readonly geojsonService: GeojsonService
  ) {}

  async runFieldBoundary(dto: RunBoundaryRecognitionDto) {
    const input = await this.resolveInput(dto);
    const job = await (this.prisma as any).aIRecognitionJob.create({
      data: {
        farmId: dto.farmId,
        type: dto.type,
        inputSource: input.source,
        inputJson: input.data,
        status: 'PROCESSING'
      }
    });

    try {
      const polygon = this.toCandidatePolygon(input.data, dto.coordinateSystem as CoordinateSystemCode | undefined);
      const area = this.geojsonService.calculatePolygonArea(polygon);
      const boundary = await (this.prisma as any).fieldBoundary.create({
        data: {
          farmId: dto.farmId,
          name: `AI识别边界候选-${new Date().toISOString()}`,
          source: 'AI_RECOGNITION',
          coordinateSystem: 'WGS84',
          polygon,
          area: area.squareMeters,
          confidence: 0.6,
          status: 'CANDIDATE',
          rawInput: { recognitionJobId: job.id, inputSource: input.source, areaMu: area.mu }
        }
      });
      const updatedJob = await (this.prisma as any).aIRecognitionJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', resultJson: { boundaryId: boundary.id, polygon }, confidence: 0.6 }
      });
      return { job: updatedJob, boundary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedJob = await (this.prisma as any).aIRecognitionJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: message }
      });
      return { job: failedJob, boundary: null };
    }
  }

  async findJob(id: string) {
    const job = await (this.prisma as any).aIRecognitionJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('AI recognition job not found');
    return job;
  }

  private async resolveInput(dto: RunBoundaryRecognitionDto) {
    if (dto.geoJson) return { source: 'UPLOADED_GEOJSON', data: dto.geoJson };
    if (dto.mapLayerId) {
      const layer = await (this.prisma as any).mapLayer.findUnique({ where: { id: dto.mapLayerId } });
      if (!layer) throw new NotFoundException('Map layer not found');
      return { source: 'MAP_LAYER', data: layer.geoJson };
    }
    if (dto.gpsTrackId) {
      const track = await (this.prisma as any).gpsTrack.findUnique({ where: { id: dto.gpsTrackId } });
      if (!track) throw new NotFoundException('GPS track not found');
      return { source: 'GPS_TRACK', data: track.trackJson };
    }
    if (dto.droneMapJobId) {
      const job = await (this.prisma as any).droneMapJob.findUnique({ where: { id: dto.droneMapJobId } });
      if (!job) throw new NotFoundException('Drone map job not found');
      if (!job.flightTrack) throw new BadRequestException('Drone map job has no flightTrack yet');
      return { source: 'DRONE_MAP_JOB', data: job.flightTrack };
    }
    throw new BadRequestException('One input source is required');
  }

  private toCandidatePolygon(input: Record<string, any>, coordinateSystem?: CoordinateSystemCode) {
    const normalized = coordinateSystem && coordinateSystem !== 'WGS84' ? this.coordinateTransform.convertGeoJSON(input, coordinateSystem, 'WGS84') : input;
    const geometry = normalized.type === 'Feature' ? normalized.geometry : normalized;
    const polygon = geometry.type === 'LineString' ? this.geojsonService.lineStringToPolygon(geometry) : normalized;
    const closed = this.geojsonService.closePolygonIfNeeded(polygon);
    this.geojsonService.validatePolygon(closed);
    return closed;
  }
}
