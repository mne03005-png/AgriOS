import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

// Unauthenticated, read-only endpoints for the OpenAgriOS v0.1-alpha demo dashboard only.
//
// The alpha scope explicitly excludes "complex authentication" and a fresh `docker compose up`
// visitor has no account. Every existing farm/field/device/telemetry endpoint elsewhere in this
// backend (FarmController, FieldController, DeviceController, IotController) remains behind
// JwtAuthGuard + TenantGuard as before -- this controller does not touch them and exposes nothing
// beyond read access to the same kind of data a logged-in user could already see.
@ApiTags('OpenAgriOS Alpha (public, read-only)')
@Controller('open')
export class OpenAgriosPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOkResponse({ description: 'List farms' })
  @Get('farms')
  async listFarms() {
    return this.prisma.farm.findMany({ select: { id: true, name: true, type: true, address: true } });
  }

  @ApiOkResponse({ description: 'List fields for a farm' })
  @Get('farms/:farmId/fields')
  async listFields(@Param('farmId') farmId: string) {
    return this.prisma.field.findMany({
      where: { farmId },
      select: { id: true, name: true, areaMu: true, cropSeasons: { select: { cropName: true }, take: 1, orderBy: { createdAt: 'desc' } } }
    });
  }

  @ApiOkResponse({ description: 'List devices for a field' })
  @Get('fields/:fieldId/devices')
  async listDevices(@Param('fieldId') fieldId: string) {
    return this.prisma.device.findMany({
      where: { fieldId },
      select: { id: true, code: true, name: true, type: true, online: true, lastTelemetryAt: true }
    });
  }

  @ApiOkResponse({ description: 'Latest telemetry reading for a device' })
  @Get('devices/:deviceId/telemetry/latest')
  async latestTelemetry(@Param('deviceId') deviceId: string) {
    const reading = await this.prisma.sensorRecord.findFirst({
      where: { deviceId },
      orderBy: { reportedAt: 'desc' },
      select: { soilMoisture: true, temperature: true, humidity: true, battery: true, reportedAt: true }
    });
    if (!reading) throw new NotFoundException('No telemetry yet for this device');
    return reading;
  }

  @ApiOkResponse({ description: 'Recent telemetry history for a device' })
  @Get('devices/:deviceId/telemetry/history')
  async telemetryHistory(@Param('deviceId') deviceId: string, @Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 500);
    return this.prisma.sensorRecord.findMany({
      where: { deviceId },
      orderBy: { reportedAt: 'desc' },
      take,
      select: { soilMoisture: true, temperature: true, humidity: true, battery: true, reportedAt: true }
    });
  }

  @ApiOkResponse({ description: 'Open alerts for a farm' })
  @Get('farms/:farmId/alerts')
  async alerts(@Param('farmId') farmId: string) {
    return (this.prisma as any).safetyAlert.findMany({
      where: { farmId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, alertType: true, severity: true, message: true, createdAt: true }
    });
  }

  // One aggregate call for the dashboard, so apps/dashboard's static JS does not need to
  // orchestrate five separate requests just to render one screen.
  @ApiOkResponse({ description: 'Farm + first field + first device + latest telemetry + open alerts, in one call' })
  @Get('farms/:farmId/snapshot')
  async snapshot(@Param('farmId') farmId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId }, select: { id: true, name: true } });
    if (!farm) throw new NotFoundException('Farm not found');

    const field = await this.prisma.field.findFirst({ where: { farmId }, select: { id: true, name: true, areaMu: true }, orderBy: { createdAt: 'asc' } });
    const device = field
      ? await this.prisma.device.findFirst({
          where: { fieldId: field.id },
          select: { id: true, code: true, name: true, online: true, lastTelemetryAt: true },
          orderBy: { createdAt: 'asc' }
        })
      : null;
    const telemetry = device
      ? await this.prisma.sensorRecord.findFirst({
          where: { deviceId: device.id },
          orderBy: { reportedAt: 'desc' },
          select: { soilMoisture: true, temperature: true, humidity: true, battery: true, reportedAt: true }
        })
      : null;
    const alerts = await (this.prisma as any).safetyAlert.findMany({
      where: { farmId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, alertType: true, severity: true, message: true, createdAt: true }
    });

    return { farm, field, device, telemetry, alerts };
  }
}
