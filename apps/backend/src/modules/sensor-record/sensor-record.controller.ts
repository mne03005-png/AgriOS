import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateSensorRecordDto } from './dto/create-sensor-record.dto';
import { UpdateSensorRecordDto } from './dto/update-sensor-record.dto';
import { SensorRecordService } from './sensor-record.service';

@Controller('sensor-records')
export class SensorRecordController extends BasicCrudController<CreateSensorRecordDto, UpdateSensorRecordDto> {
  constructor(service: SensorRecordService) {
    super(service);
  }
}
