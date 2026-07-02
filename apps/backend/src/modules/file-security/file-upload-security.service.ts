import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

type UploadFile = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.ps1', '.sh', '.js', '.ts', '.vbs', '.msi', '.dll']);
const allowedMimePrefixes = ['text/', 'application/json', 'application/geo+json', 'application/zip', 'application/octet-stream', 'image/tiff'];

@Injectable()
export class FileUploadSecurityService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  async validate(file: UploadFile | undefined, options: { allowedExtensions: string[]; farmId?: string; entityType?: string }) {
    if (!file?.originalname) throw new BadRequestException('file is required');
    const maxBytes = Number(this.config.get<string>('UPLOAD_MAX_FILE_MB') ?? 20) * 1024 * 1024;
    const safeName = this.sanitizeFileName(file.originalname);
    const ext = this.extensionOf(safeName);

    const reject = async (message: string) => {
      await this.log('upload.rejected', options.farmId, { fileName: safeName, ext, mimeType: file.mimetype, size: file.size, reason: message });
      throw new BadRequestException(message);
    };

    if (blockedExtensions.has(ext)) await reject(`Blocked unsafe file extension: ${ext}`);
    if (!options.allowedExtensions.includes(ext)) await reject(`Unsupported file extension: ${ext || 'unknown'}`);
    const buffer = file.buffer;
    if (!buffer) {
      await reject('Uploaded file buffer is empty');
      throw new BadRequestException('Uploaded file buffer is empty');
    }
    if ((file.size ?? buffer.length) > maxBytes) await reject(`File size exceeds ${this.config.get<string>('UPLOAD_MAX_FILE_MB') ?? 20}MB`);
    if (file.mimetype && !this.isAllowedMime(file.mimetype)) await reject(`Unsupported MIME type: ${file.mimetype}`);

    await this.log('upload.accepted', options.farmId, { fileName: safeName, ext, mimeType: file.mimetype, size: file.size, entityType: options.entityType });
    return { ...file, originalname: safeName, buffer: buffer as Buffer };
  }

  sanitizeFileName(fileName: string) {
    return fileName.replace(/\\/g, '/').split('/').pop()?.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_') || 'upload.dat';
  }

  extensionOf(fileName: string) {
    const index = fileName.lastIndexOf('.');
    return index >= 0 ? fileName.slice(index).toLowerCase() : '';
  }

  private isAllowedMime(mimeType: string) {
    return allowedMimePrefixes.some((item) => mimeType === item || mimeType.startsWith(item));
  }

  private log(eventType: string, farmId: string | undefined, payload: Record<string, unknown>) {
    return (this.prisma as any).eventLog.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId,
        userId: this.requestContext.getUserId(),
        requestId: this.requestContext.getRequestId(),
        eventType,
        severity: eventType.endsWith('rejected') ? 'WARNING' : 'INFO',
        entityType: 'Upload',
        payload
      }
    });
  }
}
