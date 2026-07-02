import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { ServiceProviderService } from './service-provider.service';

@Controller('service-providers')
export class ServiceProviderController extends BasicCrudController<CreateServiceProviderDto, UpdateServiceProviderDto> {
  constructor(service: ServiceProviderService) {
    super(service);
  }
}
