import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RunWettingSimulationDto } from './dto/run-wetting-simulation.dto';
import { WettingSimulationService } from './wetting-simulation.service';

@ApiTags('P7.1 湿润模拟')
@Controller('wetting-simulations')
export class WettingSimulationController {
  constructor(private readonly service: WettingSimulationService) {}

  @Post('run')
  @ApiOkResponse({ description: '运行湿润模拟' })
  run(@Body() dto: RunWettingSimulationDto) {
    return this.service.run(dto);
  }
}
