import { Controller, UseGuards } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmService } from './farm.service';

@Controller('farms')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FarmController extends BasicCrudController<CreateFarmDto, UpdateFarmDto> {
  constructor(service: FarmService) {
    super(service);
  }
}
