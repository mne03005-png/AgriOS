import { Injectable, NotFoundException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { getPagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogService } from '../operation-log/operation-log.service';
import { BindPlotDto } from './dto/bind-plot.dto';
import { ConfirmBindingCandidateDto } from './dto/confirm-binding-candidate.dto';
import { CreateIotDeviceDto } from './dto/create-iot-device.dto';
import { LinkThingsBoardDeviceDto } from './dto/link-thingsboard-device.dto';
import { UpdateIotDeviceDto } from './dto/update-iot-device.dto';
import { IotSyncAuditService } from './iot-sync-audit.service';
import { ThingsBoardClientService } from './thingsboard-client.service';

@Injectable()
export class IotDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thingsBoardClient: ThingsBoardClientService,
    private readonly operationLogService: OperationLogService,
    private readonly syncAuditService: IotSyncAuditService,
    private readonly requestContext: RequestContextService
  ) {}

  findByDeviceName(deviceName?: string) {
    if (!deviceName) return null;
    return this.prisma.device.findFirst({
      where: { OR: [{ code: deviceName }, { name: deviceName }] },
      include: { field: true }
    });
  }

  findByThingsboardDeviceId(thingsboardDeviceId?: string) {
    if (!thingsboardDeviceId) return null;
    return (this.prisma as any).device.findFirst({
      where: { thingsboardDeviceId },
      include: { field: true }
    });
  }

  async resolvePlotBinding(input: { deviceName?: string; thingsboardDeviceId?: string }) {
    const device = (await this.findByThingsboardDeviceId(input.thingsboardDeviceId)) ?? (await this.findByDeviceName(input.deviceName));
    return {
      device,
      plotId: device?.fieldId ?? null,
      farmId: device?.field?.farmId ?? null
    };
  }

  async findAll(query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = this.tenantWhere(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } : {});
    const [items, total] = await this.prisma.$transaction([
      this.prisma.device.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: this.safeDeviceSelect(true) }),
      this.prisma.device.count({ where })
    ]);
    return paginatedResult(items.map((item) => this.toSafeDeviceResponse(item)), page, pageSize, total);
  }

  async findOne(id: string) {
    const device = await (this.prisma as any).device.findFirst({ where: this.tenantWhere({ id }), select: this.safeDeviceSelect(true) });
    if (!device) throw new NotFoundException('IoT device not found');
    return this.toSafeDeviceResponse(device);
  }

  async findByField(fieldId: string, query: ListQueryDto = {}) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where = this.tenantWhere({ fieldId });
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).device.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: this.safeDeviceSelect(true) }),
      (this.prisma as any).device.count({ where })
    ]);
    return paginatedResult(items.map((item: any) => this.toSafeDeviceResponse(item)), page, pageSize, total);
  }

  status() {
    return {
      readOnly: true,
      controlEnabled: false,
      deviceControlMode: process.env.DEVICE_CONTROL_MODE ?? 'MOCK',
      deviceControlDryRun: (process.env.DEVICE_CONTROL_DRY_RUN ?? 'true').toLowerCase() === 'true',
      valveAllowRealControl: (process.env.VALVE_ALLOW_REAL_CONTROL ?? 'false').toLowerCase() === 'true',
      enableAutoExecution: (process.env.ENABLE_AUTO_EXECUTION ?? 'false').toLowerCase() === 'true'
    };
  }

  create(dto: CreateIotDeviceDto) {
    return (this.prisma as any).device.create({
      data: {
        name: dto.name,
        code: dto.code ?? dto.name,
        type: dto.deviceType ?? 'SOIL_SENSOR',
        thingsboardDeviceId: dto.thingsboardDeviceId,
        thingsboardAccessToken: dto.thingsboardAccessToken,
        fieldId: dto.plotId,
        iotStatus: dto.plotId ? 'BOUND' : 'UNBOUND',
        bindingSource: dto.plotId ? 'MANUAL' : 'UNKNOWN'
      }
    });
  }

  update(id: string, dto: UpdateIotDeviceDto) {
    return (this.prisma as any).device.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.deviceType,
        thingsboardDeviceId: dto.thingsboardDeviceId,
        thingsboardAccessToken: dto.thingsboardAccessToken,
        fieldId: dto.plotId,
        ...(dto.plotId ? { iotStatus: 'BOUND' } : {})
      }
    });
  }

  async bindPlot(id: string, dto: BindPlotDto) {
    const [device, field] = await Promise.all([
      (this.prisma as any).device.findUnique({ where: { id } }),
      this.prisma.field.findUnique({ where: { id: dto.plotId } })
    ]);
    if (!device) throw new NotFoundException('IoT device not found');
    if (!field) throw new NotFoundException('Field not found');

    const updated = await (this.prisma as any).device.update({
      where: { id },
      data: { fieldId: dto.plotId, iotStatus: 'BOUND', bindingSource: 'MANUAL' }
    });
    await this.operationLogService.create({
      action: 'BIND_IOT_DEVICE_TO_FIELD',
      targetType: 'Device',
      targetId: updated.id,
      description: 'Bind IoT device to field',
      metadata: { fieldId: dto.plotId, thingsboardDeviceId: updated.thingsboardDeviceId }
    });
    return updated;
  }

  async unbindPlot(id: string) {
    const device = await (this.prisma as any).device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('IoT device not found');

    const updated = await (this.prisma as any).device.update({
      where: { id },
      data: { fieldId: null, iotStatus: 'UNBOUND', bindingSource: 'UNKNOWN' }
    });
    await this.operationLogService.create({
      action: 'UNBIND_IOT_DEVICE_FROM_FIELD',
      targetType: 'Device',
      targetId: updated.id,
      description: 'Unbind IoT device from field',
      metadata: { previousFieldId: device.fieldId, thingsboardDeviceId: updated.thingsboardDeviceId }
    });
    return updated;
  }

  async getHealth(id: string) {
    const device = await (this.prisma as any).device.findFirst({ where: this.tenantWhere({ id }), select: this.safeDeviceSelect(true) });
    if (!device) throw new NotFoundException('IoT device not found');

    const lastTelemetryAt = device.lastTelemetryAt ?? device.lastReportedAt;
    const minutesSinceLastTelemetry =
      lastTelemetryAt instanceof Date ? Math.floor((Date.now() - lastTelemetryAt.getTime()) / 1000 / 60) : null;
    const offlineMinutes = this.getOfflineMinutes();
    const isOnline = minutesSinceLastTelemetry !== null && minutesSinceLastTelemetry <= offlineMinutes;
    return {
      device: this.toSafeDeviceResponse(device),
      iotStatus: isOnline ? 'ONLINE' : device.iotStatus === 'UNBOUND' ? 'UNBOUND' : 'OFFLINE',
      lastTelemetryAt,
      minutesSinceLastTelemetry,
      isOnline
    };
  }

  async checkHealth() {
    const devices = await (this.prisma as any).device.findMany();
    const offlineMinutes = this.getOfflineMinutes();
    const result = { checked: devices.length, online: 0, offline: 0, disabled: 0, updated: 0 };

    for (const device of devices) {
      if (device.iotStatus === 'DISABLED') {
        result.disabled += 1;
        continue;
      }
      const lastTelemetryAt = device.lastTelemetryAt ?? device.lastReportedAt;
      const minutesSinceLastTelemetry =
        lastTelemetryAt instanceof Date ? Math.floor((Date.now() - lastTelemetryAt.getTime()) / 1000 / 60) : null;
      const nextStatus = minutesSinceLastTelemetry !== null && minutesSinceLastTelemetry <= offlineMinutes ? 'ONLINE' : 'OFFLINE';
      nextStatus === 'ONLINE' ? (result.online += 1) : (result.offline += 1);
      if (device.iotStatus !== nextStatus || device.online !== (nextStatus === 'ONLINE')) {
        await (this.prisma as any).device.update({
          where: { id: device.id },
          data: { iotStatus: nextStatus, online: nextStatus === 'ONLINE' }
        });
        result.updated += 1;
      }
    }

    await this.operationLogService.create({
      action: 'CHECK_IOT_DEVICE_HEALTH',
      targetType: 'Device',
      targetId: 'all',
      description: 'Check IoT device health manually',
      metadata: { ...result, offlineMinutes }
    });
    return result;
  }

  async syncThingsBoardDevices() {
    const startedAt = new Date();
    const thingsBoardDevices = await this.thingsBoardClient.getTenantDevices();
    let created = 0;
    let updated = 0;
    let bound = 0;
    let unbound = 0;
    const warnings: string[] = [];
    const items = [];

    for (const thingsBoardDevice of thingsBoardDevices) {
      const thingsboardDeviceId = this.thingsBoardClient.getDeviceId(thingsBoardDevice);
      if (!thingsboardDeviceId || !thingsBoardDevice.name) {
        warnings.push('Skip ThingsBoard device without id or name.');
        continue;
      }

      let attributes: Record<string, unknown> = {};
      let relations: unknown[] = [];
      try {
        attributes = await this.thingsBoardClient.getDeviceAttributes(thingsboardDeviceId);
        relations = await this.thingsBoardClient.getDeviceRelations(thingsboardDeviceId);
      } catch (error) {
        warnings.push(`Failed to read attributes or relations for ${thingsBoardDevice.name}: ${this.errorMessage(error)}`);
      }

      const existing =
        (await (this.prisma as any).device.findFirst({ where: { thingsboardDeviceId } })) ??
        (await (this.prisma as any).device.findFirst({
          where: { OR: [{ code: thingsBoardDevice.name }, { name: thingsBoardDevice.name }] }
        }));
      const attributePlotId = this.stringAttribute(attributes, ['agriosPlotId']) ?? this.stringAttribute(attributes, ['plotId']);
      const attributeFieldId = await this.resolveAttributeFieldId(attributePlotId, warnings, thingsBoardDevice.name);
      const mappedDeviceType = this.mapThingsBoardDeviceType(this.stringAttribute(attributes, ['deviceType']) ?? thingsBoardDevice.type);
      const currentStatus = {
        ...(this.objectValue(existing?.currentStatus) ?? {}),
        thingsboardAttributes: attributes,
        thingsboardRelations: relations,
        cropType: this.stringAttribute(attributes, ['cropType']),
        installLocation: this.stringAttribute(attributes, ['installLocation']),
        latitude: this.numberAttribute(attributes, 'latitude'),
        longitude: this.numberAttribute(attributes, 'longitude'),
        thresholdSoilMoisture: this.numberAttribute(attributes, 'thresholdSoilMoisture'),
        agriosTenantId: this.stringAttribute(attributes, ['agriosTenantId']),
        agriosFarmId: this.stringAttribute(attributes, ['agriosFarmId', 'farmId'])
      };
      const bindingDecision = this.resolveBindingDecision(existing, attributeFieldId, attributePlotId, warnings, thingsBoardDevice.name);
      const data: Record<string, unknown> = {
        name: thingsBoardDevice.name,
        code: existing?.code ?? thingsBoardDevice.name,
        type: mappedDeviceType,
        thingsboardDeviceId,
        fieldId: bindingDecision.fieldId,
        iotStatus: bindingDecision.fieldId ? 'BOUND' : 'UNBOUND',
        bindingSource: bindingDecision.bindingSource,
        currentStatus,
        remark: this.stringAttribute(attributes, ['remark']) ?? existing?.remark
      };

      if (existing) {
        const device = await (this.prisma as any).device.update({ where: { id: existing.id }, data });
        updated += 1;
        if (bindingDecision.fieldId && bindingDecision.fieldId !== existing.fieldId) bound += 1;
        if (!device.fieldId) unbound += 1;
        items.push(device);
      } else {
        const device = await (this.prisma as any).device.create({ data });
        created += 1;
        device.fieldId ? (bound += 1) : (unbound += 1);
        items.push(device);
      }
    }

    await this.operationLogService.create({
      action: 'SYNC_THINGSBOARD_DEVICES',
      targetType: 'ThingsBoard',
      targetId: 'devices',
      description: 'Sync ThingsBoard devices to AgriOS',
      metadata: { synced: items.length, created, updated, bound, unbound, warnings }
    });

    const rawResult = { synced: items.length, created, updated, bound, unbound, warnings };
    await this.syncAuditService.create({
      tenantId: this.requestContext.getTenantId(),
      syncType: 'devices',
      total: thingsBoardDevices.length,
      created,
      updated,
      bound,
      unbound,
      warnings,
      rawResult,
      startedAt,
      finishedAt: new Date()
    });

    return { ...rawResult, items };
  }

  async getThingsBoardAssets() {
    const assets = await this.thingsBoardClient.getAssets();
    return { items: assets, total: assets.length };
  }

  async getBindingCandidates(id: string) {
    const device = await (this.prisma as any).device.findFirst({
      where: this.tenantWhere({ id }),
      select: {
        id: true,
        name: true,
        fieldId: true,
        bindingSource: true,
        thingsboardDeviceId: true,
        currentStatus: true
      }
    });
    if (!device) throw new NotFoundException('IoT device not found');

    const warnings: string[] = [];
    const candidates: Array<Record<string, unknown>> = [];
    const currentStatus = this.objectValue(device.currentStatus) ?? {};
    const localAttributes = this.objectValue(currentStatus.thingsboardAttributes) ?? {};
    await this.addAttributeCandidates(localAttributes, candidates, warnings);

    if (device.bindingSource === 'MANUAL') {
      warnings.push('Current bindingSource is MANUAL; candidates will not automatically override the current field binding.');
    }

    if (device.thingsboardDeviceId) {
      try {
        const [attributes, relations, assets] = await Promise.all([
          this.thingsBoardClient.getDeviceAttributes(device.thingsboardDeviceId),
          this.thingsBoardClient.getDeviceRelations(device.thingsboardDeviceId),
          this.thingsBoardClient.getAssets()
        ]);
        await this.addAttributeCandidates(attributes, candidates, warnings);
        await this.addRelationCandidates(relations, assets, candidates, warnings);
      } catch (error) {
        warnings.push(`ThingsBoard API unavailable for binding candidates: ${this.errorMessage(error)}`);
      }
    } else {
      warnings.push('Device has no thingsboardDeviceId; only local cached attributes were used.');
    }

    return {
      deviceId: device.id,
      deviceName: device.name,
      currentPlotId: device.fieldId,
      bindingSource: device.bindingSource,
      candidates: this.uniqueCandidates(candidates),
      warnings
    };
  }

  async confirmBindingCandidate(id: string, dto: ConfirmBindingCandidateDto) {
    const [device, field] = await Promise.all([
      (this.prisma as any).device.findUnique({ where: { id }, include: { field: true } }),
      this.prisma.field.findUnique({ where: { id: dto.plotId } })
    ]);
    if (!device) throw new NotFoundException('IoT device not found');
    if (!field) throw new NotFoundException('Field not found');

    const hasManualConflict = device.fieldId && device.fieldId !== dto.plotId && device.bindingSource === 'MANUAL';
    if (hasManualConflict && !dto.force) {
      return {
        confirmed: false,
        conflict: true,
        message: 'Device already has a MANUAL binding. Use force=true to override.',
        currentPlotId: device.fieldId,
        requestedPlotId: dto.plotId,
        bindingSource: device.bindingSource
      };
    }

    const updated = await (this.prisma as any).device.update({
      where: { id },
      data: {
        fieldId: dto.plotId,
        iotStatus: 'BOUND',
        bindingSource: 'MANUAL',
        currentStatus: {
          ...(this.objectValue(device.currentStatus) ?? {}),
          confirmedBindingCandidate: {
            source: dto.source,
            remark: dto.remark,
            force: Boolean(dto.force),
            confirmedAt: new Date().toISOString()
          }
        }
      },
      include: { field: true }
    });

    await this.operationLogService.create({
      action: dto.force && hasManualConflict ? 'OVERRIDE_DEVICE_MANUAL_BINDING' : 'CONFIRM_DEVICE_BINDING_CANDIDATE',
      targetType: 'Device',
      targetId: id,
      description: 'Confirm IoT device binding candidate',
      metadata: {
        previousFieldId: device.fieldId,
        fieldId: dto.plotId,
        source: dto.source,
        force: Boolean(dto.force),
        remark: dto.remark
      } as any
    });

    return {
      confirmed: true,
      conflict: hasManualConflict,
      warning: hasManualConflict && dto.force ? 'Manual binding was overridden by force=true.' : null,
      device: updated
    };
  }

  async findBindingCandidatesByThingsBoard(input: { thingsboardDeviceId?: string; deviceName?: string }) {
    const thingsboardDeviceId = this.clean(input.thingsboardDeviceId);
    const deviceName = this.clean(input.deviceName);
    const deviceOr = [
      ...(thingsboardDeviceId ? [{ thingsboardDeviceId }] : []),
      ...(deviceName ? [{ code: deviceName }, { name: deviceName }, { name: { contains: deviceName } }, { code: { contains: deviceName } }] : [])
    ];
    const devices = deviceOr.length
      ? await (this.prisma as any).device.findMany({
          where: this.tenantWhere({ OR: deviceOr }),
          select: {
            id: true,
            name: true,
            fieldId: true,
            thingsboardDeviceId: true,
            iotStatus: true,
            bindingSource: true,
            field: { select: { farmId: true } }
          },
          take: 10
        })
      : [];
    const fields = deviceName
      ? await this.prisma.field.findMany({
          where: this.tenantWhere({
            OR: [{ name: { contains: deviceName } }, { farm: { name: { contains: deviceName } } }]
          }),
          include: { farm: true },
          take: 10
        })
      : [];

    const candidates = [
      ...devices.map((device: any) => ({
        deviceId: device.id,
        deviceName: device.name,
        farmId: device.field?.farmId ?? null,
        fieldId: device.fieldId ?? null,
        zoneId: null,
        matchReason: device.thingsboardDeviceId === thingsboardDeviceId ? 'thingsboardDeviceId matched existing AgriOS device' : 'deviceName matched existing AgriOS device',
        confidence: device.thingsboardDeviceId === thingsboardDeviceId ? 'HIGH' : 'MEDIUM',
        bindingStatus: device.iotStatus,
        bindingSource: device.bindingSource
      })),
      ...fields.map((field: any) => ({
        deviceId: null,
        deviceName: null,
        farmId: field.farmId,
        fieldId: field.id,
        zoneId: null,
        matchReason: `deviceName resembles field or farm ${field.name}`,
        confidence: 'LOW',
        bindingStatus: 'CANDIDATE',
        bindingSource: 'NAME_MATCH'
      }))
    ];

    return {
      thingsboardDeviceId,
      deviceName,
      candidates: this.uniqueBindingCandidates(candidates),
      warnings: candidates.length ? [] : ['No AgriOS device or field candidate matched the supplied ThingsBoard identity.']
    };
  }

  async linkThingsBoardDevice(id: string, dto: LinkThingsBoardDeviceDto) {
    const device = await (this.prisma as any).device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('IoT device not found');

    const currentStatus = this.objectValue(device.currentStatus) ?? {};
    const updated = await (this.prisma as any).device.update({
      where: { id },
      data: {
        thingsboardDeviceId: dto.thingsboardDeviceId ?? device.thingsboardDeviceId,
        name: dto.thingsboardDeviceName ?? device.name,
        code: device.code ?? dto.thingsboardDeviceName ?? device.name,
        iotStatus: device.fieldId ? 'BOUND' : device.iotStatus,
        currentStatus: {
          ...currentStatus,
          thingsboardDeviceName: dto.thingsboardDeviceName,
          telemetryKeys: Array.isArray(dto.telemetryKeys) ? dto.telemetryKeys : [],
          linkedThingsBoardAt: new Date().toISOString()
        }
      },
      include: { field: true }
    });

    await this.operationLogService.create({
      action: 'LINK_THINGSBOARD_DEVICE',
      targetType: 'Device',
      targetId: id,
      description: 'Link AgriOS device to ThingsBoard identity',
      metadata: {
        previousThingsboardDeviceId: device.thingsboardDeviceId,
        thingsboardDeviceId: updated.thingsboardDeviceId,
        thingsboardDeviceName: dto.thingsboardDeviceName,
        telemetryKeys: dto.telemetryKeys ?? []
      } as any
    });

    await (this.prisma as any).auditEvent
      .create({
        data: {
          tenantId: updated.tenantId,
          eventType: 'iot.device.link_thingsboard',
          severity: 'INFO',
          entityType: 'Device',
          entityId: id,
          payload: {
            thingsboardDeviceId: updated.thingsboardDeviceId,
            thingsboardDeviceName: dto.thingsboardDeviceName,
            telemetryKeys: dto.telemetryKeys ?? []
          }
        }
      })
      .catch(() => null);

    return { linked: true, device: updated };
  }

  recordTelemetryAudit(input: {
    tenantId?: string | null;
    payload: unknown;
    deviceName?: string;
    thingsboardDeviceId?: string;
    sensorRecordCreated: boolean;
    snapshotUpdated: boolean;
    warnings: string[];
  }) {
    const now = new Date();
    return this.syncAuditService.create({
      tenantId: input.tenantId,
      syncType: 'telemetry',
      total: 1,
      created: input.sensorRecordCreated ? 1 : 0,
      updated: input.snapshotUpdated ? 1 : 0,
      bound: 0,
      unbound: 0,
      warnings: input.warnings,
      rawResult: {
        deviceName: input.deviceName,
        thingsboardDeviceId: input.thingsboardDeviceId,
        snapshotUpdated: input.snapshotUpdated,
        rawPayload: input.payload
      },
      startedAt: now,
      finishedAt: now
    });
  }

  private async resolveAttributeFieldId(plotId: string | undefined, warnings: string[], deviceName: string) {
    if (!plotId) return null;
    const field = await this.prisma.field.findUnique({ where: { id: plotId } });
    if (!field) {
      warnings.push(`Device ${deviceName} references unknown plotId ${plotId}.`);
      return null;
    }
    return field.id;
  }

  private async addAttributeCandidates(attributes: Record<string, unknown>, candidates: Array<Record<string, unknown>>, warnings: string[]) {
    const explicitPlotId = this.stringAttribute(attributes, ['agriosPlotId']) ?? this.stringAttribute(attributes, ['plotId']);
    if (explicitPlotId) {
      const field = await this.prisma.field.findUnique({ where: { id: explicitPlotId } });
      if (field) {
        candidates.push({
          type: 'FIELD',
          plotId: field.id,
          fieldName: field.name,
          source: 'THINGSBOARD_ATTRIBUTE',
          confidence: 'HIGH',
          reason: `ThingsBoard attribute points to field ${field.name}`
        });
      } else {
        warnings.push(`ThingsBoard attribute plotId ${explicitPlotId} does not match any AgriOS Field.`);
      }
    }

    const farmId = this.stringAttribute(attributes, ['agriosFarmId', 'farmId']);
    if (farmId) {
      const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
      if (farm) {
        candidates.push({
          type: 'FARM',
          farmId: farm.id,
          source: 'THINGSBOARD_ATTRIBUTE',
          confidence: 'MEDIUM',
          reason: `ThingsBoard attribute points to farm ${farm.name}`
        });
      } else {
        warnings.push(`ThingsBoard attribute farmId ${farmId} does not match any AgriOS Farm.`);
      }
    }
  }

  private async addRelationCandidates(
    relations: unknown[],
    assets: unknown[],
    candidates: Array<Record<string, unknown>>,
    warnings: string[]
  ) {
    const assetList = assets.filter((asset): asset is Record<string, any> => Boolean(asset && typeof asset === 'object'));
    for (const relation of relations.filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))) {
      const relationAssetId = relation.to?.id ?? relation.from?.id;
      const asset = assetList.find((item) => this.thingsBoardClient.getAssetId(item) === relationAssetId);
      const assetName = typeof asset?.name === 'string' ? asset.name : undefined;
      if (!assetName) {
        warnings.push('ThingsBoard relation points to an asset that could not be matched locally.');
        continue;
      }
      const field = await this.prisma.field.findFirst({ where: { name: { contains: assetName } } });
      if (field) {
        candidates.push({
          type: 'FIELD',
          plotId: field.id,
          fieldName: field.name,
          source: 'THINGSBOARD_RELATION',
          confidence: 'MEDIUM',
          reason: `ThingsBoard relation points to asset ${assetName}`
        });
        continue;
      }
      const farm = await this.prisma.farm.findFirst({ where: { name: { contains: assetName } } });
      if (farm) {
        candidates.push({
          type: 'FARM',
          farmId: farm.id,
          source: 'THINGSBOARD_RELATION',
          confidence: 'LOW',
          reason: `ThingsBoard relation points to asset ${assetName}`
        });
      } else {
        warnings.push(`ThingsBoard relation asset ${assetName} did not match any AgriOS Field/Farm.`);
      }
    }
  }

  private uniqueCandidates(candidates: Array<Record<string, unknown>>) {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const key = `${candidate.type}:${candidate.plotId ?? candidate.farmId}:${candidate.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private uniqueBindingCandidates(candidates: Array<Record<string, unknown>>) {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const key = `${candidate.deviceId ?? 'none'}:${candidate.fieldId ?? 'none'}:${candidate.matchReason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private resolveBindingDecision(
    existing: any,
    attributeFieldId: string | null,
    requestedPlotId: string | undefined,
    warnings: string[],
    deviceName: string
  ) {
    const existingFieldId = existing?.fieldId ?? null;
    const existingBindingSource = existing?.bindingSource ?? 'UNKNOWN';
    const manualProtected =
      existingFieldId &&
      (existingBindingSource === 'MANUAL' || existingBindingSource === 'UNKNOWN');

    if (manualProtected) {
      if (attributeFieldId && attributeFieldId !== existingFieldId) {
        warnings.push(
          `Device ${deviceName} attribute plotId ${attributeFieldId} conflicts with manual binding ${existingFieldId}; manual binding was kept.`
        );
      }
      return { fieldId: existingFieldId, bindingSource: existingBindingSource === 'UNKNOWN' ? 'MANUAL' : existingBindingSource };
    }

    if (attributeFieldId) {
      return { fieldId: attributeFieldId, bindingSource: 'THINGSBOARD_ATTRIBUTE' };
    }

    if (requestedPlotId && !attributeFieldId) {
      warnings.push(`Device ${deviceName} requested plotId ${requestedPlotId}, but AgriOS Field was not found.`);
    }

    return {
      fieldId: existingFieldId,
      bindingSource: existingFieldId ? existingBindingSource : 'UNKNOWN'
    };
  }

  private mapThingsBoardDeviceType(type?: string) {
    const normalized = (type ?? '').toUpperCase();
    if (normalized.includes('PUMP')) return 'PUMP';
    if (normalized.includes('VALVE')) return 'VALVE';
    if (normalized.includes('CAMERA')) return 'CAMERA';
    if (normalized.includes('WEATHER')) return 'WEATHER_SENSOR';
    if (normalized.includes('SOIL')) return 'SOIL_SENSOR';
    return 'OTHER';
  }

  private getOfflineMinutes() {
    const value = Number(process.env.IOT_DEVICE_OFFLINE_MINUTES ?? 10);
    return Number.isFinite(value) && value > 0 ? value : 10;
  }

  private stringAttribute(attributes: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = attributes[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return undefined;
  }

  private clean(value?: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private numberAttribute(attributes: Record<string, unknown>, key: string) {
    const value = Number(attributes[key]);
    return Number.isFinite(value) ? value : undefined;
  }

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private tenantWhere<T extends Record<string, unknown>>(where: T) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId || this.requestContext.isPlatformAdmin()) return where;
    return { ...where, tenantId };
  }

  private safeDeviceSelect(includeField = false) {
    return {
      id: true,
      tenantId: true,
      fieldId: true,
      code: true,
      name: true,
      type: true,
      thingsboardDeviceId: true,
      iotStatus: true,
      bindingSource: true,
      mqttTopic: true,
      online: true,
      currentStatus: true,
      lastReportedAt: true,
      lastTelemetryAt: true,
      remark: true,
      createdAt: true,
      updatedAt: true,
      ...(includeField
        ? {
            field: {
              select: {
                id: true,
                tenantId: true,
                farmId: true,
                name: true,
                areaMu: true,
                location: true,
                latitude: true,
                longitude: true,
                soilType: true,
                irrigationMethod: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        : {})
    };
  }

  private toSafeDeviceResponse(device: any) {
    if (!device || typeof device !== 'object') return device;
    return this.sanitizeSensitiveKeys(device);
  }

  private sanitizeSensitiveKeys(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeSensitiveKeys(item));
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return value;
    const blocked = new Set(['thingsboardAccessToken', 'accessToken', 'deviceToken', 'mqttPassword', 'password', 'secret', 'apiKey', 'privateKey', 'authorization']);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !blocked.has(key))
        .map(([key, item]) => [key, this.sanitizeSensitiveKeys(item)])
    );
  }
}
