import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { BatchDeadLetterRetryDto } from './dto/batch-dead-letter-retry.dto';
import { BatchMarkDeadLetterResolvedDto } from './dto/batch-mark-dead-letter-resolved.dto';
import { BindPlotDto } from './dto/bind-plot.dto';
import { ConfirmBindingCandidateDto } from './dto/confirm-binding-candidate.dto';
import { CreateIotDeviceDto } from './dto/create-iot-device.dto';
import { LinkThingsBoardDeviceDto } from './dto/link-thingsboard-device.dto';
import { MarkDeadLetterResolvedDto } from './dto/mark-dead-letter-resolved.dto';
import { ThingsBoardTelemetryDto } from './dto/thingsboard-telemetry.dto';
import { UpdateIotDeviceDto } from './dto/update-iot-device.dto';
import { IotDeviceService } from './iot-device.service';
import { IotSyncAuditService } from './iot-sync-audit.service';
import { IotTelemetryNormalizerService } from './iot-telemetry-normalizer.service';
import { IotWebhookDeadLetterService } from './iot-webhook-dead-letter.service';
import { ThingsBoardWebhookService } from './thingsboard-webhook.service';

@ApiTags('IoT')
@Controller('iot')
export class IotController {
  constructor(
    private readonly webhookService: ThingsBoardWebhookService,
    private readonly iotDeviceService: IotDeviceService,
    private readonly deadLetterService: IotWebhookDeadLetterService,
    private readonly syncAuditService: IotSyncAuditService,
    private readonly telemetryNormalizerService: IotTelemetryNormalizerService
  ) {}

  @ApiOkResponse({ description: '接收 ThingsBoard 遥测成功' })
  @ApiUnauthorizedResponse({ description: 'Webhook secret 不正确' })
  @Post('thingsboard/telemetry')
  receiveThingsBoardTelemetry(@Headers('x-thingsboard-secret') secret: string | undefined, @Body() dto: ThingsBoardTelemetryDto) {
    return this.webhookService.handleTelemetry(secret, dto);
  }

  @ApiOkResponse({ description: '同步 ThingsBoard 设备成功' })
  @ApiBadGatewayResponse({ description: 'ThingsBoard 请求失败' })
  @Post('thingsboard/sync-devices')
  syncThingsBoardDevices() {
    return this.iotDeviceService.syncThingsBoardDevices();
  }

  @ApiOkResponse({ description: '查询 ThingsBoard 资产列表成功' })
  @ApiBadGatewayResponse({ description: 'ThingsBoard 请求失败' })
  @Get('thingsboard/assets')
  getThingsBoardAssets() {
    return this.iotDeviceService.getThingsBoardAssets();
  }

  @ApiOkResponse({ description: '查询 ThingsBoard 同步审计列表成功' })
  @Get('thingsboard/sync-audits')
  findSyncAudits(@Query() query: Record<string, unknown>) {
    return this.syncAuditService.findAll(query);
  }

  @ApiOkResponse({ description: '导出 ThingsBoard 同步审计 JSON 成功' })
  @ApiNotFoundResponse({ description: '同步审计不存在' })
  @Get('thingsboard/sync-audits/:id/export')
  exportSyncAudit(@Param('id') id: string, @Query('format') format?: string) {
    return this.syncAuditService.exportOne(id, format ?? 'json');
  }

  @ApiOkResponse({ description: '查询 ThingsBoard 同步审计详情成功' })
  @ApiNotFoundResponse({ description: '同步审计不存在' })
  @Get('thingsboard/sync-audits/:id')
  findSyncAudit(@Param('id') id: string) {
    return this.syncAuditService.findOne(id);
  }

  @ApiOkResponse({ description: '查询 IoT Webhook Dead Letter 列表成功' })
  @Get('webhook-dead-letters')
  findDeadLetters(@Query() query: Record<string, unknown>) {
    return this.deadLetterService.findAll(query);
  }

  @ApiOkResponse({ description: '批量重试 IoT Webhook Dead Letter 成功' })
  @Post('webhook-dead-letters/batch-retry')
  batchRetryDeadLetters(@Body() dto: BatchDeadLetterRetryDto) {
    return this.deadLetterService.batchRetry(dto, (payload) => this.webhookService.replayTelemetry(payload));
  }

  @ApiOkResponse({ description: '批量标记 IoT Webhook Dead Letter 已处理成功' })
  @Post('webhook-dead-letters/batch-mark-resolved')
  batchMarkDeadLettersResolved(@Body() dto: BatchMarkDeadLetterResolvedDto) {
    return this.deadLetterService.batchMarkResolved(dto);
  }

  @ApiOkResponse({ description: '预览 IoT Webhook Dead Letter 重放影响成功' })
  @ApiNotFoundResponse({ description: 'Dead Letter 不存在' })
  @Get('webhook-dead-letters/:id/preview')
  previewDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.preview(id, (payload) => this.webhookService.previewTelemetry(payload));
  }

  @ApiOkResponse({ description: '查看 IoT Webhook Dead Letter 重放差异成功' })
  @ApiNotFoundResponse({ description: 'Dead Letter 不存在' })
  @Get('webhook-dead-letters/:id/diff')
  diffDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.diff(id, (payload) => this.webhookService.previewTelemetry(payload));
  }

  @ApiOkResponse({ description: '标记 IoT Webhook Dead Letter 已处理成功' })
  @ApiNotFoundResponse({ description: 'Dead Letter 不存在' })
  @Post('webhook-dead-letters/:id/mark-resolved')
  markDeadLetterResolved(@Param('id') id: string, @Body() dto: MarkDeadLetterResolvedDto) {
    return this.deadLetterService.markResolved(id, dto.remark);
  }

  @ApiOkResponse({ description: '重试单条 IoT Webhook Dead Letter 成功' })
  @ApiNotFoundResponse({ description: 'Dead Letter 不存在' })
  @Post('webhook-dead-letters/:id/retry')
  retryDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.retry(id, (payload) => this.webhookService.replayTelemetry(payload));
  }

  @ApiOkResponse({ description: '查询 IoT 设备列表成功' })
  @Get('devices')
  @UseGuards(TenantGuard)
  findDevices(@Query() query: ListQueryDto) {
    return this.iotDeviceService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query AgriOS binding candidates for a ThingsBoard device identity' })
  @Get('devices/binding-candidates')
  @UseGuards(TenantGuard)
  getThingsBoardBindingCandidates(@Query('thingsboardDeviceId') thingsboardDeviceId?: string, @Query('deviceName') deviceName?: string) {
    return this.iotDeviceService.findBindingCandidatesByThingsBoard({ thingsboardDeviceId, deviceName });
  }

  @ApiOkResponse({ description: '手动巡检 IoT 设备在线状态成功' })
  @Post('devices/check-health')
  checkDevicesHealth() {
    return this.iotDeviceService.checkHealth();
  }

  @ApiOkResponse({ description: '查询设备最新标准化遥测' })
  @Get('devices/:id/telemetry/latest')
  @UseGuards(TenantGuard)
  getLatestTelemetry(@Param('id') id: string) {
    return this.telemetryNormalizerService.latestForDevice(id);
  }

  @ApiOkResponse({ description: 'Query latest real sensor telemetry for a farm' })
  @Get('farms/:farmId/telemetry/latest-real-sensor')
  @UseGuards(TenantGuard)
  getLatestRealSensorTelemetry(@Param('farmId') farmId: string) {
    return this.telemetryNormalizerService.latestForFarm(farmId);
  }

  @ApiOkResponse({ description: '查询农场水压、流量、水泵、液位摘要' })
  @Get('farms/:farmId/telemetry/summary')
  @UseGuards(TenantGuard)
  getFarmTelemetrySummary(@Param('farmId') farmId: string) {
    return this.telemetryNormalizerService.farmSummary(farmId);
  }

  @ApiOkResponse({ description: '查询 IoT 设备详情成功' })
  @ApiNotFoundResponse({ description: '设备不存在' })
  @Get('devices/:id')
  @UseGuards(TenantGuard)
  findDevice(@Param('id') id: string) {
    return this.iotDeviceService.findOne(id);
  }

  @ApiOkResponse({ description: '查询 IoT 设备在线健康状态成功' })
  @ApiNotFoundResponse({ description: '设备不存在' })
  @Get('devices/:id/health')
  @UseGuards(TenantGuard)
  getDeviceHealth(@Param('id') id: string) {
    return this.iotDeviceService.getHealth(id);
  }

  @ApiOkResponse({ description: '查询 IoT 设备绑定候选建议成功' })
  @ApiNotFoundResponse({ description: '设备不存在' })
  @Get('devices/:id/binding-candidates')
  @UseGuards(TenantGuard)
  getDeviceBindingCandidates(@Param('id') id: string) {
    return this.iotDeviceService.getBindingCandidates(id);
  }

  @ApiOkResponse({ description: 'Link an AgriOS device with a ThingsBoard identity' })
  @Post('devices/:id/link-thingsboard')
  @UseGuards(TenantGuard)
  linkThingsBoardDevice(@Param('id') id: string, @Body() dto: LinkThingsBoardDeviceDto) {
    return this.iotDeviceService.linkThingsBoardDevice(id, dto);
  }

  @ApiOkResponse({ description: '人工确认 IoT 设备绑定候选成功' })
  @ApiNotFoundResponse({ description: '设备或地块不存在' })
  @Post('devices/:id/confirm-binding-candidate')
  @UseGuards(TenantGuard)
  confirmDeviceBindingCandidate(@Param('id') id: string, @Body() dto: ConfirmBindingCandidateDto) {
    return this.iotDeviceService.confirmBindingCandidate(id, dto);
  }

  @ApiCreatedResponse({ description: '创建 IoT 设备成功' })
  @Post('devices')
  createDevice(@Body() dto: CreateIotDeviceDto) {
    return this.iotDeviceService.create(dto);
  }

  @ApiOkResponse({ description: '更新 IoT 设备成功' })
  @ApiNotFoundResponse({ description: '设备不存在' })
  @Patch('devices/:id')
  updateDevice(@Param('id') id: string, @Body() dto: UpdateIotDeviceDto) {
    return this.iotDeviceService.update(id, dto);
  }

  @ApiOkResponse({ description: '绑定 IoT 设备到地块成功' })
  @ApiNotFoundResponse({ description: '设备或地块不存在' })
  @Post('devices/:id/bind-plot')
  bindPlot(@Param('id') id: string, @Body() dto: BindPlotDto) {
    return this.iotDeviceService.bindPlot(id, dto);
  }

  @ApiOkResponse({ description: '解绑 IoT 设备和地块成功' })
  @ApiNotFoundResponse({ description: '设备不存在' })
  @Post('devices/:id/unbind-plot')
  unbindPlot(@Param('id') id: string) {
    return this.iotDeviceService.unbindPlot(id);
  }
}
