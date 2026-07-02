import { Module } from '@nestjs/common';
import { IrrigationDesignController } from './irrigation-design.controller';
import { IrrigationDesignService } from './irrigation-design.service';

@Module({
  controllers: [IrrigationDesignController],
  providers: [IrrigationDesignService],
  exports: [IrrigationDesignService]
})
export class IrrigationDesignModule {}
