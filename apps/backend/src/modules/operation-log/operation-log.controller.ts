import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { OperationLogService } from './operation-log.service';

@Controller('operation-logs')
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.operationLogService.findAll(query);
  }

  @Get('by-field/:fieldId')
  findByField(@Param('fieldId') fieldId: string, @Query() query: ListQueryDto) {
    return this.operationLogService.findByField(fieldId, query);
  }
}
