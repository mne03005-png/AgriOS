import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
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

  // Platform-wide by design: getTenantDevices() pulls the entire ThingsBoard-side device list
  // (ThingsBoard's own "tenant" concept, not AgriOS's), and the resulting AgriOS device lookup/
  // create has no per-AgriOS-tenant scoping concept to filter by. No scheduler/cron calls this --
  // it is a manual, admin-triggered sweep across the whole integrated fleet. PLATFORM_CONTEXT is
  // the existing permission already used for exactly this "operates across tenants" category
  // (see TenantController). Retrofitting a tenant filter here would require redesigning how
  // ThingsBoard identities map to AgriOS tenants -- out of scope; see SEC-IOT-2 report.
  @ApiOkResponse({ description: 'Sync ThingsBoard devices' })
  @ApiBadGatewayResponse({ description: 'ThingsBoard request failed' })
  @Post('thingsboard/sync-devices')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PLATFORM_CONTEXT)
  syncThingsBoardDevices() {
    return this.iotDeviceService.syncThingsBoardDevices();
  }

  @ApiOkResponse({ description: 'Query ThingsBoard assets' })
  @ApiBadGatewayResponse({ description: 'ThingsBoard request failed' })
  @Get('thingsboard/assets')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.INTEGRATION_READ)
  getThingsBoardAssets() {
    return this.iotDeviceService.getThingsBoardAssets();
  }

  @ApiOkResponse({ description: 'Query ThingsBoard sync audits' })
  @Get('thingsboard/sync-audits')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.INTEGRATION_READ)
  findSyncAudits(@Query() query: Record<string, unknown>) {
    return this.syncAuditService.findAll(query);
  }

  @ApiOkResponse({ description: 'Export ThingsBoard sync audit' })
  @ApiNotFoundResponse({ description: 'Sync audit not found' })
  @Get('thingsboard/sync-audits/:id/export')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.INTEGRATION_READ)
  exportSyncAudit(@Param('id') id: string, @Query('format') format?: string, @Query('includeRaw') includeRaw?: string) {
    return this.syncAuditService.exportOne(id, format ?? 'json', includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query ThingsBoard sync audit detail' })
  @ApiNotFoundResponse({ description: 'Sync audit not found' })
  @Get('thingsboard/sync-audits/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.INTEGRATION_READ)
  findSyncAudit(@Param('id') id: string, @Query('includeRaw') includeRaw?: string) {
    return this.syncAuditService.findOne(id, includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query IoT webhook dead letters' })
  @Get('webhook-dead-letters')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  findWebhookDeadLetters(@Query() query: Record<string, unknown>) {
    return this.deadLetterService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query IoT webhook dead letters' })
  @Get('dead-letters')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  findDeadLetters(@Query() query: Record<string, unknown>) {
    return this.deadLetterService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query IoT webhook dead letter detail' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Get('dead-letters/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  findDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.findOne(id);
  }

  @ApiOkResponse({ description: 'Batch retry IoT webhook dead letters' })
  @Post('webhook-dead-letters/batch-retry')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  batchRetryDeadLetters(@Body() dto: BatchDeadLetterRetryDto) {
    return this.deadLetterService.batchRetry(dto, (payload) => this.webhookService.replayTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Batch mark IoT webhook dead letters resolved' })
  @Post('webhook-dead-letters/batch-mark-resolved')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  batchMarkDeadLettersResolved(@Body() dto: BatchMarkDeadLetterResolvedDto) {
    return this.deadLetterService.batchMarkResolved(dto);
  }

  @ApiOkResponse({ description: 'Preview IoT webhook dead letter replay' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Get('webhook-dead-letters/:id/preview')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  previewDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.preview(id, (payload) => this.webhookService.previewTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Diff IoT webhook dead letter replay' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Get('webhook-dead-letters/:id/diff')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  diffDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.diff(id, (payload) => this.webhookService.previewTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Mark IoT webhook dead letter resolved' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Post('webhook-dead-letters/:id/mark-resolved')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  markDeadLetterResolved(@Param('id') id: string, @Body() dto: MarkDeadLetterResolvedDto) {
    return this.deadLetterService.markResolved(id, dto.remark);
  }

  @ApiOkResponse({ description: 'Retry one IoT webhook dead letter' })
  @ApiNotFoundResponse({ description: 'Dead letter not found' })
  @Post('webhook-dead-letters/:id/retry')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  retryDeadLetter(@Param('id') id: string) {
    return this.deadLetterService.retry(id, (payload) => this.webhookService.replayTelemetry(payload));
  }

  @ApiOkResponse({ description: 'Query IoT devices' })
  @Get('devices')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  findDevices(@Query() query: ListQueryDto) {
    return this.iotDeviceService.findAll(query);
  }

  @ApiOkResponse({ description: 'Query binding candidates for a ThingsBoard identity' })
  @Get('devices/binding-candidates')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getThingsBoardBindingCandidates(@Query('thingsboardDeviceId') thingsboardDeviceId?: string, @Query('deviceName') deviceName?: string) {
    return this.iotDeviceService.findBindingCandidatesByThingsBoard({ thingsboardDeviceId, deviceName });
  }

  // Platform-wide by design: device.findMany() with no where at all, sweeping every device
  // across every tenant to refresh online/offline status. No scheduler calls this either -- see
  // syncThingsBoardDevices's comment above for the same reasoning. PLATFORM_CONTEXT, not a tenant
  // filter, is the correct fix (a per-tenant "check my devices" concept doesn't exist for this
  // route and inventing one would be a business-logic redesign, out of scope for SEC-IOT-2).
  @ApiOkResponse({ description: 'Check IoT device health' })
  @Post('devices/check-health')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PLATFORM_CONTEXT)
  checkDevicesHealth() {
    return this.iotDeviceService.checkHealth();
  }

  @ApiOkResponse({ description: 'Query latest normalized telemetry for a device' })
  @Get('devices/:id/telemetry/latest')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getLatestTelemetry(@Param('id') id: string, @Query('includeRaw') includeRaw?: string) {
    return this.telemetryNormalizerService.latestForDevice(id, includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query bounded telemetry history for a device' })
  @Get('devices/:id/telemetry/history')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getTelemetryHistory(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.telemetryNormalizerService.historyForDevice(id, query, query.includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query latest real sensor telemetry for a farm' })
  @Get('farms/:farmId/telemetry/latest-real-sensor')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getLatestRealSensorTelemetry(@Param('farmId') farmId: string, @Query('includeRaw') includeRaw?: string) {
    return this.telemetryNormalizerService.latestForFarm(farmId, includeRaw === 'true');
  }

  @ApiOkResponse({ description: 'Query farm telemetry summary' })
  @Get('farms/:farmId/telemetry/summary')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getFarmTelemetrySummary(@Param('farmId') farmId: string) {
    return this.telemetryNormalizerService.farmSummary(farmId);
  }

  @ApiOkResponse({ description: 'Query devices for a field' })
  @Get('fields/:fieldId/devices')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getFieldDevices(@Param('fieldId') fieldId: string, @Query() query: ListQueryDto) {
    return this.iotDeviceService.findByField(fieldId, query);
  }

  @ApiOkResponse({ description: 'Query field telemetry summary' })
  @Get('fields/:fieldId/telemetry/summary')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
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
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  findDevice(@Param('id') id: string) {
    return this.iotDeviceService.findOne(id);
  }

  @ApiOkResponse({ description: 'Query IoT device health' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Get('devices/:id/health')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getDeviceHealth(@Param('id') id: string) {
    return this.iotDeviceService.getHealth(id);
  }

  @ApiOkResponse({ description: 'Query IoT device binding candidates' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Get('devices/:id/binding-candidates')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  getDeviceBindingCandidates(@Param('id') id: string) {
    return this.iotDeviceService.getBindingCandidates(id);
  }

  @ApiOkResponse({ description: 'Link an AgriOS device with a ThingsBoard identity' })
  @Post('devices/:id/link-thingsboard')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  linkThingsBoardDevice(@Param('id') id: string, @Body() dto: LinkThingsBoardDeviceDto) {
    return this.iotDeviceService.linkThingsBoardDevice(id, dto);
  }

  @ApiOkResponse({ description: 'Confirm an IoT device binding candidate' })
  @ApiNotFoundResponse({ description: 'Device or field not found' })
  @Post('devices/:id/confirm-binding-candidate')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  confirmDeviceBindingCandidate(@Param('id') id: string, @Body() dto: ConfirmBindingCandidateDto) {
    return this.iotDeviceService.confirmBindingCandidate(id, dto);
  }

  @ApiCreatedResponse({ description: 'Create IoT device' })
  @Post('devices')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  createDevice(@Body() dto: CreateIotDeviceDto) {
    return this.iotDeviceService.create(dto);
  }

  @ApiOkResponse({ description: 'Update IoT device' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Patch('devices/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  updateDevice(@Param('id') id: string, @Body() dto: UpdateIotDeviceDto) {
    return this.iotDeviceService.update(id, dto);
  }

  @ApiOkResponse({ description: 'Bind IoT device to field' })
  @ApiNotFoundResponse({ description: 'Device or field not found' })
  @Post('devices/:id/bind-plot')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  bindPlot(@Param('id') id: string, @Body() dto: BindPlotDto) {
    return this.iotDeviceService.bindPlot(id, dto);
  }

  @ApiOkResponse({ description: 'Unbind IoT device from field' })
  @ApiNotFoundResponse({ description: 'Device not found' })
  @Post('devices/:id/unbind-plot')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  unbindPlot(@Param('id') id: string) {
    return this.iotDeviceService.unbindPlot(id);
  }
}
