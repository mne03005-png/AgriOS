import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordinateSystemCode, CoordinateTransformService } from './coordinate-transform.service';

@Injectable()
export class DroneMapJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordinateTransform: CoordinateTransformService
  ) {}

  create(input: {
    farmId: string;
    name: string;
    imageCount?: number;
    flightTrack?: Record<string, unknown>;
    coordinateSystem?: CoordinateSystemCode;
    orthomosaicUrl?: string;
  }) {
    const flightTrack =
      input.flightTrack && input.coordinateSystem
        ? this.coordinateTransform.convertGeoJSON(input.flightTrack as any, input.coordinateSystem, 'WGS84')
        : input.flightTrack;
    return (this.prisma as any).droneMapJob.create({
      data: {
        farmId: input.farmId,
        name: input.name,
        status: 'UPLOADED',
        imageCount: input.imageCount,
        flightTrack: flightTrack as any,
        orthomosaicUrl: input.orthomosaicUrl
      }
    });
  }

  findAll(query: Record<string, unknown> = {}) {
    return (this.prisma as any).droneMapJob.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
