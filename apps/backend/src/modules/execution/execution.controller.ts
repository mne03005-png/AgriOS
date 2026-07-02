import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RunExecutionDto } from './dto/run-execution.dto';
import { ExecutionService } from './execution.service';

@ApiTags('P11 自主执行')
@Controller('execution')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('run')
  @ApiOkResponse({ description: '执行手动/辅助/自动设备动作' })
  run(@Body() dto: RunExecutionDto) {
    return this.executionService.run(dto);
  }
}
