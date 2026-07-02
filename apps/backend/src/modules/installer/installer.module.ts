import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { InstallerController } from './installer.controller';
import { InstallerService } from './installer.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InstallerController],
  providers: [InstallerService]
})
export class InstallerModule {}
