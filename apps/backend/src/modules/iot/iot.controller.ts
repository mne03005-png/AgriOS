import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

  @ApiOkResponse({ description: 'Receive ThingsBoard telemetry' })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook credentials' })
  @Post('thingsboard/telemetry')
  receiveThingsBoardTelemetry(
    @Headers('x-thingsboard-secret') secret: string | undefined,
    @Headers('x-agrios-signature') signature: string | undefined,
    @Headers('x-agrios-timestamp') timestamp: string | undefined,
    @Headers('x-agrios-event-id') eventId: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Body() dto: ThingsBoardTelemetryDto
  ) {
    return this.webhookService.handleTelemetry(secret, { ...dto, eventId: dto.eventId ?? eventId }, { signature, timestamp, eventId, contentLength });
  }

  @ApiOkResponse({ description: 'Sync ThingsBoard devices' })
  @ApiBadGatewayResponse({ description: 'ThingsBoard request failed' })
  @Post('thingsboard/sync-devices')
  @UseGuards(JwtAuthGuard, TenantGuard)
  syncThingsBoardDevices() {
    return this.iotDeviceService.syncThingsBoardDevices();
  }

  @ApiOkResponse({ description: 'Query ThingsBoard assets' })
  @ApiBadGatewayResponse({ description: 'ThingsBoard request failed' })
  @Get('thingsboard/assets')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getThingsBoardAssets() {
    return this.iotDeviceService.getThingsBoardAssets();
  }

  @ApiOkResponse({ description: 'Query ThingsBoard sync audits' })
  @Get('thingsboard/sync-audits')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findSyncAudits(@Query() query: Record<string, unknown>) {
    return this.syncAuditService.findAll(query);
  }

  @ApiOkResponse({ description: 'Export ThingsBoard sync audit' })
  @ApiNotFoundResponse({ description: 'Sync audit not found' })
  @Get('thingsboard/sync-audits/:id/export')
  @UseGuards(JwtAuthGuard, TenantGuard)
  exportSyncAudit(@Param('id') id: string, @Query('format') format?: string, @Query('includeRaw') includeRaw?: string) {
    return this.syncAuditService.exportOne(id, format ?? 'json', includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query ThingsBoard sync audit detail' })
  @ApiNotFoundResponse({ description: 'Sync audit not found' })
  @Get('thingsboard/sync-audits/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findSyncAudit(@Param('id') id: string, @Query('includeRaw') includeRaw?: string) {
    return this.syncAuditService.findOne(id, includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query IoT webhook dead letters' })
  @Get('webhook-dead-letters')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findWebhookDeadLetters(@Query() query: Record<string, unknown>) {
    return this.deadLetterService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query IoT webhook dead letters' })
  @Get('dead-letters')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findDeadLetters(@Query() query: Record<string, unknown>) {
    return this.deadLetterService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query IoT webhook dead letter detail' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Get('dead-letters/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.findOne(id);
  }

  @ApiOkResponse({ description: 'Batch retry IoT webhook dead letters' })
  @Post('webhook-dead-letters/batch-retry')
  @UseGuards(JwtAuthGuard, TenantGuard)
  batchRetryDeadLetters(@Body() dto: BatchDeadLetterRetryDto) {
    return this.deadLetterService.batchRetry(dto, (payload) => this.webhookService.replayTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Batch mark IoT webhook dead letters resolved' })
  @Post('webhook-dead-letters/batch-mark-resolved')
  @UseGuards(JwtAuthGuard, TenantGuard)
  batchMarkDeadLettersResolved(@Body() dto: BatchMarkDeadLetterResolvedDto) {
    return this.deadLetterService.batchMarkResolved(dto);
  }

  @ApiOkResponse({ description: 'Preview IoT webhook dead letter replay' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Get('webhook-dead-letters/:id/preview')
  @UseGuards(JwtAuthGuard, TenantGuard)
  previewDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.preview(id, (payload) => this.webhookService.previewTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Diff IoT webhook dead letter replay' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Get('webhook-dead-letters/:id/diff')
  @UseGuards(JwtAuthGuard, TenantGuard)
  diffDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.diff(id, (payload) => this.webhookService.previewTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Mark IoT webhook dead letter resolved' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Post('webhook-dead-letters/:id/mark-resolved')
  @UseGuards(JwtAuthGuard, TenantGuard)
  markDeadLetterResolved(@Param('id') id: string, @Body() dto: MarkDeadLetterResolvedDto) {
    return this.deadLetterService.markResolved(id, dto.remark);
  }

  @ApiOkResponse({ description: 'Retry one IoT webhook dead letter' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Post('webhook-dead-letters/:id/retry')
  @UseGuards(JwtAuthGuard, TenantGuard)
  retryDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.retry(id, (payload) => this.webhookService.replayTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Query IoT devices' })
  @Get('devices')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findDevices(@Query() query: ListQueryDto) {
    return this.iotDeviceService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query binding candidates for a ThingsBoard identity' })
  @Get('devices/binding-candidates')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getThingsBoardBindingCandidates(@Query('thingsboardDeviceId') thingsboardDeviceId?: string, @Query('deviceName') deviceName?: string) {
    return this.iotDeviceService.findBindingCandidatesByThingsBoard({ thingsboardDeviceId, deviceName });
  }

  @ApiOkResponse({ description: 'Check IoT device health' })
  @Post('devices/check-health')
  @UseGuards(JwtAuthGuard, TenantGuard)
  checkDevicesHealth() {
    return this.iotDeviceService.checkHealth();
  }

  @ApiOkResponse({ description: 'Query latest normalized telemetry for a device' })
  @Get('devices/:id/telemetry/latest')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getLatestTelemetry(@Param('id') id: string, @Query('includeRaw') includeRaw?: string) {
    return this.telemetryNormalizerService.latestForDevice(id, includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query bounded telemetry history for a device' })
  @Get('devices/:id/telemetry/history')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getTelemetryHistory(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.telemetryNormalizerService.historyForDevice(id, query, query.includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query latest real sensor telemetry for a farm' })
  @Get('farms/:farmId/telemetry/latest-real-sensor')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getLatestRealSensorTelemetry(@Param('farmId') farmId: string, @Query('includeRaw') includeRaw?: string) {
    return this.telemetryNormalizerService.latestForFarm(farmId, includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query farm telemetry summary' })
  @Get('farms/:farmId/telemetry/summary')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getFarmTelemetrySummary(@Param('farmId') farmId: string) {
    return this.telemetryNormalizerService.farmSummary(farmId);
  }

  @ApiOkResponse({ description: 'Query devices for a field' })
  @Get('fields/:fieldId/devices')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getFieldDevices(@Param('fieldId') fieldId: string, @Query() query: ListQueryDto) {
    return this.iotDeviceService.findByField(fieldId, query);
  }

  @ApiOkResponse({ description: 'Query field telemetry summary' })
  @Get('fields/:fieldId/telemetry/summary')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getFieldTelemetrySummary(@Param('fieldId') fieldId: string) {
    return this.telemetryNormalizerService.fieldSummary(fieldId);
  }

  @ApiOkResponse({ description: 'Query read-only IoT status' })
  @Get('status')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getIotStatus() {
    return this.iotDeviceService.status();
  }

  @ApiOkResponse({ description: 'Query IoT device detail' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Get('devices/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findDevice(@Param('id') id: string) {
    return this.iotDeviceService.findOne(id);
  }

  @ApiOkResponse({ description: 'Query IoT device health' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Get('devices/:id/health')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getDeviceHealth(@Param('id') id: string) {
    return this.iotDeviceService.getHealth(id);
  }

  @ApiOkResponse({ description: 'Query IoT device binding candidates' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Get('devices/:id/binding-candidates')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getDeviceBindingCandidates(@Param('id') id: string) {
    return this.iotDeviceService.getBindingCandidates(id);
  }

  @ApiOkResponse({ description: 'Link an AgriOS device with a ThingsBoard identity' })
  @Post('devices/:id/link-thingsboard')
  @UseGuards(JwtAuthGuard, TenantGuard)
  linkThingsBoardDevice(@Param('id') id: string, @Body() dto: LinkThingsBoardDeviceDto) {
    return this.iotDeviceService.linkThingsBoardDevice(id, dto);
  }

  @ApiOkResponse({ description: 'Confirm an IoT device binding candidate' })
  @ApiNotFoundResponse({ description: 'Device or field not found' })
  @Post('devices/:id/confirm-binding-candidate')
  @UseGuards(JwtAuthGuard, TenantGuard)
  confirmDeviceBindingCandidate(@Param('id') id: string, @Body() dto: ConfirmBindingCandidateDto) {
    return this.iotDeviceService.confirmBindingCandidate(id, dto);
  }

  @ApiCreatedResponse({ description: 'Create IoT device' })
  @Post('devices')
  @UseGuards(JwtAuthGuard, TenantGuard)
  createDevice(@Body() dto: CreateIotDeviceDto) {
    return this.iotDeviceService.create(dto);
  }

  @ApiOkResponse({ description: 'Update IoT device' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Patch('devices/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateDevice(@Param('id') id: string, @Body() dto: UpdateIotDeviceDto) {
    return this.iotDeviceService.update(id, dto);
  }

  @ApiOkResponse({ description: 'Bind IoT device to field' })
  @ApiNotFoundResponse({ description: 'Device or field not found' })
  @Post('devices/:id/bind-plot')
  @UseGuards(JwtAuthGuard, TenantGuard)
  bindPlot(@Param('id') id: string, @Body() dto: BindPlotDto) {
    return this.iotDeviceService.bindPlot(id, dto);
  }

  @ApiOkResponse({ description: 'Unbind IoT device from field' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Post('devices/:id/unbind-plot')
  @UseGuards(JwtAuthGuard, TenantGuard)
  unbindPlot(@Param('id') id: string) {
    return this.iotDeviceService.unbindPlot(id);
  }
}
