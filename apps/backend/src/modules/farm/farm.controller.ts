import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmService } from './farm.service';

@Controller('farms')
export class FarmController extends BasicCrudController<CreateFarmDto, UpdateFarmDto> {
  constructor(service: FarmService) {
    super(service);
  }
}
