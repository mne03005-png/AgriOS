import { Body, Controller, Post } from '@nestjs/common';
import { EvaluateIrrigationRuleDto } from './dto/evaluate-irrigation-rule.dto';
import { IrrigationRuleService } from './irrigation-rule.service';

@Controller('irrigation-rules')
export class IrrigationRuleController {
  constructor(private readonly irrigationRuleService: IrrigationRuleService) {}

  @Post('evaluate')
  evaluate(@Body() dto: EvaluateIrrigationRuleDto) {
    return this.irrigationRuleService.evaluate(dto);
  }
}
