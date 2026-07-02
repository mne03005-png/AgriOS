import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateDroneOperationDto } from './dto/create-drone-operation.dto';
import { ImportDroneOperationDto } from './dto/import-drone-operation.dto';
import { LinkDroneOperationFieldDto } from './dto/link-drone-operation-field.dto';
import { UpdateDroneOperationDto } from './dto/update-drone-operation.dto';
import { DroneOperationService } from './drone-operation.service';
import { FileUploadSecurityService } from '../file-security/file-upload-security.service';

const allowedExt = new Set(['.kml', '.geojson', '.json', '.csv', '.kmz', '.zip', '.tif', '.tiff', '.tfw']);
const blockedExt = new Set(['.exe', '.bat', '.cmd', '.ps1', '.js', '.mjs', '.vbs', '.com', '.scr', '.sh']);

@ApiTags('P11.5 Drone Operations')
@Controller('drone-operations')
export class DroneOperationController {
  constructor(
    private readonly service: DroneOperationService,
    private readonly fileSecurity: FileUploadSecurityService
  ) {}

  @Post('import-file')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['farmId', 'source', 'operationType', 'file'],
      properties: {
        farmId: { type: 'string', example: 'farm_onion_001' },
        fieldId: { type: 'string', example: 'field_onion_a' },
        source: { type: 'string', example: 'DJI_SMARTFARM' },
        operationType: { type: 'string', example: 'SPRAYING' },
        droneModel: { type: 'string', example: 'DJI Agras T50' },
        chemicalName: { type: 'string', example: '洋葱叶面肥' },
        sprayVolumeL: { type: 'number', example: 92 },
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @ApiCreatedResponse({ description: '上传并解析无人机作业文件，支持 KML/GeoJSON/CSV/GeoTIFF 占位，KMZ/ZIP 记录失败任务' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const ext = extensionOf(file.originalname);
        if (blockedExt.has(ext)) return callback(new BadRequestException(`Blocked unsafe file extension: ${ext}`), false);
        if (!allowedExt.has(ext)) return callback(new BadRequestException(`Unsupported drone file extension: ${ext || 'unknown'}`), false);
        return callback(null, true);
      }
    })
  )
  async importFile(@UploadedFile() file: any, @Body() body: Record<string, unknown>) {
    const safeFile = await this.fileSecurity.validate(file, {
      allowedExtensions: Array.from(allowedExt),
      farmId: typeof body.farmId === 'string' ? body.farmId : undefined,
      entityType: 'DroneImportJob'
    });
    return this.service.importFile(safeFile, body);
  }

  @Post('import')
  @ApiCreatedResponse({ description: '导入 DJI/KML/GeoJSON/GeoTIFF/CSV 无人机作业数据' })
  import(@Body() dto: ImportDroneOperationDto) {
    return this.service.import(dto);
  }

  @Post()
  @ApiCreatedResponse({ description: '手动创建无人机作业记录' })
  create(@Body() dto: CreateDroneOperationDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOkResponse({ description: '查询无人机作业列表' })
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get('import-jobs/:id')
  @ApiOkResponse({ description: '查询无人机导入任务详情' })
  getImportJob(@Param('id') id: string) {
    return this.service.getImportJob(id);
  }

  @Get(':id')
  @ApiOkResponse({ description: '查询无人机作业详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: '更新无人机作业' })
  update(@Param('id') id: string, @Body() dto: UpdateDroneOperationDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/link-field')
  @ApiOkResponse({ description: '关联无人机作业到地块/地块边界' })
  linkField(@Param('id') id: string, @Body() dto: LinkDroneOperationFieldDto) {
    return this.service.linkField(id, dto);
  }

  @Post(':id/generate-report')
  @ApiOkResponse({ description: '生成无人机作业报告' })
  generateReport(@Param('id') id: string) {
    return this.service.generateReport(id);
  }
}

function extensionOf(fileName: string) {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index).toLowerCase() : '';
}
