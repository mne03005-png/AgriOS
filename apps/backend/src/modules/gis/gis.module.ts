import { Module } from '@nestjs/common';
import { BoundaryRecognitionService } from './boundary-recognition.service';
import { CoordinateTransformService } from './coordinate-transform.service';
import { DroneMapJobService } from './drone-map-job.service';
import { GeojsonService } from './geojson.service';
import { GisController } from './gis.controller';
import { GisService } from './gis.service';
import { GpsTrackService } from './gps-track.service';

@Module({
  controllers: [GisController],
  providers: [GisService, CoordinateTransformService, GeojsonService, BoundaryRecognitionService, GpsTrackService, DroneMapJobService],
  exports: [GisService, CoordinateTransformService, GeojsonService]
})
export class GisModule {}
