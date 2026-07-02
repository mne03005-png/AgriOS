import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { WorkLogService } from './work-log.service';

@Controller('work-logs')
export class WorkLogController extends BasicCrudController<CreateWorkLogDto, UpdateWorkLogDto> {
  constructor(service: WorkLogService) {
    super(service);
  }
}
