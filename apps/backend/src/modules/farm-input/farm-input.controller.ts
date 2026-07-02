import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateFarmInputDto } from './dto/create-farm-input.dto';
import { UpdateFarmInputDto } from './dto/update-farm-input.dto';
import { FarmInputService } from './farm-input.service';

@Controller('farm-inputs')
export class FarmInputController extends BasicCrudController<CreateFarmInputDto, UpdateFarmInputDto> {
  constructor(service: FarmInputService) {
    super(service);
  }
}
