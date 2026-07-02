import { Module } from '@nestjs/common';
import { FarmInputController } from './farm-input.controller';
import { FarmInputService } from './farm-input.service';

@Module({
  controllers: [FarmInputController],
  providers: [FarmInputService],
  exports: [FarmInputService]
})
export class FarmInputModule {}
