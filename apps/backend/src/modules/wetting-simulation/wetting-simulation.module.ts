import { Module } from '@nestjs/common';
import { WettingSimulationController } from './wetting-simulation.controller';
import { WettingSimulationService } from './wetting-simulation.service';

@Module({
  controllers: [WettingSimulationController],
  providers: [WettingSimulationService],
  exports: [WettingSimulationService]
})
export class WettingSimulationModule {}
