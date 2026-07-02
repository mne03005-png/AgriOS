import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { BluetoothController } from './bluetooth.controller';
import { BluetoothService } from './bluetooth.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [BluetoothController],
  providers: [BluetoothService]
})
export class BluetoothModule {}
