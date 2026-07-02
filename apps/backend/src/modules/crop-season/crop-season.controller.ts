import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateCropSeasonDto } from './dto/create-crop-season.dto';
import { UpdateCropSeasonDto } from './dto/update-crop-season.dto';
import { CropSeasonService } from './crop-season.service';

@Controller('crop-seasons')
export class CropSeasonController extends BasicCrudController<CreateCropSeasonDto, UpdateCropSeasonDto> {
  constructor(service: CropSeasonService) {
    super(service);
  }
}
