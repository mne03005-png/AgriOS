import { Module } from '@nestjs/common';
import { SensorRecordController } from './sensor-record.controller';
import { SensorRecordService } from './sensor-record.service';

@Module({
  controllers: [SensorRecordController],
  providers: [SensorRecordService],
  exports: [SensorRecordService]
})
export class SensorRecordModule {}
