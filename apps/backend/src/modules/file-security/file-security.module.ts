import { Module } from '@nestjs/common';
import { FileUploadSecurityService } from './file-upload-security.service';

@Module({
  providers: [FileUploadSecurityService],
  exports: [FileUploadSecurityService]
})
export class FileSecurityModule {}
