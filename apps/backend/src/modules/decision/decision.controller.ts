import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DecisionService } from './decision.service';
import { RunDecisionRequestDto } from './dto/run-decision-request.dto';

@ApiTags('Decision')
@Controller('decision')
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  @ApiOkResponse({ description: 'Run decision and return field state, strategy, and action plan' })
  @Post('run')
  run(@Body() dto: RunDecisionRequestDto) {
    return this.decisionService.run(dto);
  }
}
