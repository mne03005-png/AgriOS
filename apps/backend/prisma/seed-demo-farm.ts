import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const tenantId = 'demo-tenant';
const farmId = 'demo';
const now = new Date();

const fields = [
  { id: 'demo-field-onion-a', name: '洋葱A区', areaMu: 300, offset: 0 },
  { id: 'demo-field-onion-b', name: '洋葱B区', areaMu: 180, offset: 0.045 },
  { id: 'demo-field-corn-test', name: '玉米试验区', areaMu: 120, offset: 0.085 }
];

const onionPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [118.095, 36.7],
      [118.13, 36.702],
      [118.126, 36.736],
      [118.094, 36.734],
      [118.095, 36.7]
    ]
  ]
};

const onionRoute = {
  type: 'LineString',
  coordinates: [
    [118.096, 36.704],
    [118.122, 36.707],
    [118.098, 36.716],
    [118.124, 36.724],
    [118.1, 36.732]
  ]
};

export async function seedDemoFarm(client: PrismaClient = prisma) {
  await client.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: 'AgriOS Demo Tenant',
      type: 'DEMO',
      status: 'ACTIVE',
      metadata: { demo: true, code: 'demo baseline' }
    },
    create: {
      id: tenantId,
      name: 'AgriOS Demo Tenant',
      type: 'DEMO',
      status: 'ACTIVE',
      metadata: { demo: true, code: 'demo baseline' },
      remark: 'P11.7 demo baseline'
    }
  });

  await client.farm.upsert({
    where: { id: farmId },
    update: {
      tenantId,
      name: '洋葱智慧农场 Demo',
      type: 'COMPANY',
      remark: 'P11.7 demo baseline'
    },
    create: {
      id: farmId,
      tenantId,
      name: '洋葱智慧农场 Demo',
      type: 'COMPANY',
      address: '山东省潍坊市 AgriOS Demo',
      contactName: 'Demo Farmer',
      contactPhone: '13800000000',
      remark: 'P11.7 demo baseline'
    }
  });

  await client.tenantFarm.upsert({
    where: { tenantId_farmId: { tenantId, farmId } },
    update: { role: 'OWNER' },
    create: { tenantId, farmId, role: 'OWNER' }
  });

  const demoPasswordHash = await bcrypt.hash('demo123456', 10);
  await client.user.upsert({
    where: { phone: 'demo@agrios.local' },
    update: {
      tenantId,
      farmId,
      email: 'demo@agrios.local',
      name: 'Demo 农场管理员',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: demoPasswordHash,
      remark: 'P12 demo auth baseline'
    },
    create: {
      id: 'demo-user',
      tenantId,
      farmId,
      phone: 'demo@agrios.local',
      email: 'demo@agrios.local',
      name: 'Demo 农场管理员',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      passwordHash: demoPasswordHash,
      remark: 'P12 demo auth baseline'
    }
  });

  for (const item of fields) {
    await client.field.upsert({
      where: { id: item.id },
      update: {
        tenantId,
        farmId,
        name: item.name,
        areaMu: item.areaMu,
        soilType: item.id.includes('corn') ? 'sandy_loam' : 'loam',
        irrigationMethod: item.id.includes('corn') ? 'sprinkler trial' : 'drip irrigation',
        remark: 'P11.7 demo baseline'
      },
      create: {
        id: item.id,
        tenantId,
        farmId,
        name: item.name,
        areaMu: item.areaMu,
        location: 'AgriOS demo farm',
        latitude: 36.71 + item.offset,
        longitude: 118.1 + item.offset,
        soilType: item.id.includes('corn') ? 'sandy_loam' : 'loam',
        waterSource: 'demo well + reservoir',
        irrigationMethod: item.id.includes('corn') ? 'sprinkler trial' : 'drip irrigation',
        landSource: 'SELF',
        lastYearCrop: item.id.includes('corn') ? '玉米' : '洋葱',
        currentSuggestion: item.id.includes('corn') ? '试验区用于对比水肥策略' : '洋葱不建议连作，注意病害和养分平衡',
        remark: 'P11.7 demo baseline'
      }
    });
  }

  const boundaryA = await client.fieldBoundary.upsert({
    where: { id: 'demo-boundary-onion-a' },
    update: {
      tenantId,
      farmId,
      fieldId: 'demo-field-onion-a',
      polygon: onionPolygon,
      areaMu: 300,
      status: 'APPROVED',
      rawInput: { demo: true, source: 'samples/drone/onion-field-a.kml' }
    },
    create: {
      id: 'demo-boundary-onion-a',
      tenantId,
      farmId,
      fieldId: 'demo-field-onion-a',
      name: '洋葱A区边界',
      source: 'DRONE_FLIGHT',
      coordinateSystem: 'WGS84',
      polygon: onionPolygon,
      areaMu: 300,
      areaSquareMeters: 200000,
      confidence: 0.96,
      status: 'APPROVED',
      rawInput: { demo: true, source: 'samples/drone/onion-field-a.kml' }
    }
  });

  await client.mapLayer.upsert({
    where: { id: 'demo-layer-field-onion-a' },
    update: {
      tenantId,
      farmId,
      geoJson: onionPolygon,
      styleJson: { demo: true, fieldId: 'demo-field-onion-a', stroke: '#16a34a', fill: '#16a34a55' },
      isVisible: true
    },
    create: {
      id: 'demo-layer-field-onion-a',
      tenantId,
      farmId,
      name: '洋葱A区 FIELD 图层',
      type: 'FIELD',
      source: 'DEMO_SEED',
      coordinateSystem: 'WGS84',
      geoJson: onionPolygon,
      styleJson: { demo: true, fieldId: 'demo-field-onion-a', stroke: '#16a34a', fill: '#16a34a55' },
      isVisible: true
    }
  });

  const devices = await seedDevices(client);
  await seedTelemetry(client, devices);
  await seedSensorRecords(client, devices.soil.id);
  const design = await seedIrrigationDesign(client, boundaryA.id, devices.valve.id);
  await seedRecipeAndSimulation(client, design.id);
  const rotationGroupId = await seedRotation(client, design.id, devices.valve.id);
  await seedFertigation(client, rotationGroupId, devices.fertigation.id);
  const droneOperationId = await seedDroneOperation(client, boundaryA.id);
  await seedBusinessRecords(client, droneOperationId);
  await seedActivities(client, droneOperationId);
  await seedP12ProductionSkeleton(client, droneOperationId);
  await seedValveDryRunBaseline(client, devices.valve.id);

  return { tenantId, farmId, fieldIds: fields.map((item) => item.id), droneOperationId };
}

async function seedDevices(client: PrismaClient) {
  const definitions = [
    ['soil', 'demo-soil-moisture-001', '洋葱A区土壤湿度传感器', 'SOIL_SENSOR', 'agrios/demo/soil-001/telemetry'],
    ['pressure', 'demo-pressure-001', '首部压力传感器', 'OTHER', 'agrios/demo/pressure-001/telemetry'],
    ['flow', 'demo-flow-001', '主管流量计', 'FLOW_METER', 'agrios/demo/flow-001/telemetry'],
    ['valve', 'demo-valve-001', '洋葱A区电动阀', 'VALVE', 'agrios/demo/valve-001/status'],
    ['pump', 'demo-pump-001', 'Demo 水泵控制器', 'PUMP', 'agrios/demo/pump-001/status'],
    ['fertigation', 'demo-fertigation-001', 'Demo 水肥一体机', 'OTHER', 'agrios/demo/fertigation-001/status'],
    ['tank', 'demo-fertilizer-tank-001', 'Demo 肥料罐液位', 'WATER_LEVEL', 'agrios/demo/tank-001/telemetry'],
    ['gateway', 'demo-gateway-001', 'Demo 物联网网关', 'GATEWAY', 'agrios/demo/gateway-001/status']
  ] as const;
  const result: Record<string, any> = {};
  for (const [key, code, name, type, mqttTopic] of definitions) {
    result[key] = await client.device.upsert({
      where: { code },
      update: {
        tenantId,
        fieldId: key === 'gateway' ? null : 'demo-field-onion-a',
        name,
        type,
        mqttTopic,
        online: true,
        currentStatus: key === 'valve' ? { demo: true, baseline: true, online: true, valveStatus: 'CLOSED', valveOpeningPercent: 0 } : { demo: true, baseline: true, online: true },
        lastReportedAt: now,
        lastTelemetryAt: now,
        remark: 'P11.7 demo baseline'
      },
      create: {
        tenantId,
        fieldId: key === 'gateway' ? null : 'demo-field-onion-a',
        code,
        name,
        type,
        mqttTopic,
        online: true,
        currentStatus: key === 'valve' ? { demo: true, baseline: true, online: true, valveStatus: 'CLOSED', valveOpeningPercent: 0 } : { demo: true, baseline: true, online: true },
        lastReportedAt: now,
        lastTelemetryAt: now,
        remark: 'P11.7 demo baseline'
      }
    });
  }
  return result as Record<string, { id: string }>;
}

async function seedTelemetry(client: PrismaClient, devices: Record<string, { id: string }>) {
  const rows = [
    { deviceId: devices.pressure.id, pressureKpa: 238, normalizedJson: { pressureKpa: 238 } },
    { deviceId: devices.flow.id, flowRateM3h: 42.5, normalizedJson: { flowRateM3h: 42.5 } },
    { deviceId: devices.valve.id, valveOpeningPercent: 0, normalizedJson: { valveStatus: 'CLOSED', valveOpeningPercent: 0, lastCommandStatus: 'ACKED' } },
    { deviceId: devices.pump.id, pumpFrequencyHz: 38, pumpRunningStatus: 'STANDBY', normalizedJson: { pumpFrequencyHz: 38, pumpRunningStatus: 'STANDBY' } },
    { deviceId: devices.tank.id, fertilizerTankLevelL: 420, normalizedJson: { fertilizerTankLevelL: 420 } },
    { deviceId: devices.soil.id, batteryPercent: 86, signalStrength: 72, normalizedJson: { soilMoisture: 32, batteryPercent: 86, signalStrength: 72 } },
    { deviceId: devices.gateway.id, batteryPercent: 100, signalStrength: 91, normalizedJson: { signalStrength: 91 } }
  ];
  for (const row of rows) {
    await client.deviceTelemetrySnapshot.upsert({
      where: { deviceId: row.deviceId },
      update: { ...row, tenantId, farmId, fieldId: row.deviceId === devices.gateway.id ? null : 'demo-field-onion-a', reportedAt: now, rawPayload: { demo: true } },
      create: { id: `demo-snapshot-${row.deviceId}`, ...row, tenantId, farmId, fieldId: row.deviceId === devices.gateway.id ? null : 'demo-field-onion-a', reportedAt: now, rawPayload: { demo: true } }
    });
  }
}

async function seedSensorRecords(client: PrismaClient, soilDeviceId: string) {
  for (let hour = 0; hour < 24; hour += 1) {
    const reportedAt = new Date(now.getTime() - (23 - hour) * 60 * 60 * 1000);
    const moisture = 29 + Math.sin(hour / 3) * 4 + hour * 0.12;
    await client.sensorRecord.upsert({
      where: { id: `demo-soil-moisture-${hour.toString().padStart(2, '0')}` },
      update: {
        tenantId,
        deviceId: soilDeviceId,
        fieldId: 'demo-field-onion-a',
        value: moisture,
        soilMoisture: moisture,
        temperature: 28 + Math.sin(hour / 4) * 3,
        humidity: 58 + Math.cos(hour / 5) * 8,
        battery: 86,
        rawPayload: { demo: true, hour },
        normalizedJson: { demo: true, moistureTrend: true },
        reportedAt
      },
      create: {
        id: `demo-soil-moisture-${hour.toString().padStart(2, '0')}`,
        tenantId,
        deviceId: soilDeviceId,
        fieldId: 'demo-field-onion-a',
        deviceName: '洋葱A区土壤湿度传感器',
        type: 'SOIL_MOISTURE',
        value: moisture,
        unit: '%',
        soilMoisture: moisture,
        temperature: 28 + Math.sin(hour / 4) * 3,
        humidity: 58 + Math.cos(hour / 5) * 8,
        battery: 86,
        rawPayload: { demo: true, hour },
        normalizedJson: { demo: true, moistureTrend: true },
        source: 'demo baseline',
        reportedAt
      }
    });
  }
}

async function seedIrrigationDesign(client: PrismaClient, boundaryId: string, valveDeviceId: string) {
  const design = await client.irrigationDesign.upsert({
    where: { id: 'demo-irrigation-design-onion-a' },
    update: {
      tenantId,
      farmId,
      fieldId: 'demo-field-onion-a',
      fieldBoundaryId: boundaryId,
      status: 'CHECKED',
      designJson: { demo: true, baseline: true, crop: 'onion' }
    },
    create: {
      id: 'demo-irrigation-design-onion-a',
      tenantId,
      farmId,
      fieldId: 'demo-field-onion-a',
      fieldBoundaryId: boundaryId,
      name: '洋葱A区滴灌设计',
      cropType: '洋葱',
      soilType: 'loam',
      designMode: 'DRIP',
      area: 200000,
      areaMu: 300,
      rowSpacing: 0.22,
      plantSpacing: 0.12,
      lateralSpacing: 1.2,
      emitterFlowRate: 1.6,
      emitterSpacing: 0.3,
      targetFlowRate: 42,
      targetPressure: 180,
      sourceWaterPressure: 250,
      designJson: { demo: true, baseline: true, crop: 'onion' },
      status: 'CHECKED'
    }
  });
  const zone = await client.irrigationDesignZone.upsert({
    where: { id: 'demo-irrigation-zone-onion-a-1' },
    update: { valveDeviceId, area: 300, pipeLength: 1200, pipeDiameter: 63, expectedFlowRate: 42, expectedPressure: 175, maxIrrigationMinutes: 45 },
    create: { id: 'demo-irrigation-zone-onion-a-1', designId: design.id, name: '洋葱A区一号轮灌区', area: 300, valveDeviceId, pipeLength: 1200, pipeDiameter: 63, expectedFlowRate: 42, expectedPressure: 175, maxIrrigationMinutes: 45 }
  });
  const bom = await client.irrigationBOM.upsert({
    where: { id: 'demo-irrigation-bom-onion-a' },
    update: { totalCost: 62800, status: 'GENERATED' },
    create: { id: 'demo-irrigation-bom-onion-a', designId: design.id, status: 'GENERATED', totalCost: 62800 }
  });
  const bomItems = [
    ['demo-bom-dripline', '滴灌带', 'DRIPLINE', '16mm 2L/h', 86000, 'm', 0.42],
    ['demo-bom-pipe', 'PE主管', 'PIPE', 'PE63', 1200, 'm', 12],
    ['demo-bom-valve', '电动阀', 'VALVE', 'DN63', 1, 'set', 980],
    ['demo-bom-filter', '过滤器', 'FILTER', '120 mesh', 1, 'set', 3200]
  ] as const;
  for (const [id, name, category, spec, quantity, unit, unitPrice] of bomItems) {
    await client.irrigationBOMItem.upsert({
      where: { id },
      update: { name, category, spec, quantity, unit, unitPrice, amount: Number(quantity) * Number(unitPrice) },
      create: { id, bomId: bom.id, name, category, spec, quantity, unit, unitPrice, amount: Number(quantity) * Number(unitPrice) }
    });
  }
  await client.hydraulicCheckResult.upsert({
    where: { id: 'demo-hydraulic-check-onion-a' },
    update: { inputJson: { demo: true }, resultJson: { demo: true, conclusion: 'passed' }, pressureLoss: 42, endPressure: 181, flowVariation: 0.08, isPassed: true, warnings: [] },
    create: { id: 'demo-hydraulic-check-onion-a', designId: design.id, zoneId: zone.id, inputJson: { demo: true }, resultJson: { demo: true, conclusion: 'passed' }, pressureLoss: 42, endPressure: 181, flowVariation: 0.08, isPassed: true, warnings: [] }
  });
  return design;
}

async function seedRecipeAndSimulation(client: PrismaClient, designId: string) {
  await client.cropIrrigationRecipe.upsert({
    where: { id: 'demo-onion-irrigation-recipe' },
    update: { targetMoistureMin: 35, targetMoistureMax: 58, recommendedIrrigationMinutes: 30, maxDailyIrrigationMinutes: 90, isActive: true },
    create: { id: 'demo-onion-irrigation-recipe', tenantId, cropType: '洋葱', cropStage: 'GROWING', soilType: 'loam', targetMoistureMin: 35, targetMoistureMax: 58, recommendedIrrigationMinutes: 30, maxDailyIrrigationMinutes: 90, fertigationAdvice: { demo: true, npk: '18-18-18' }, isActive: true }
  });
  await client.wettingSimulation.upsert({
    where: { id: 'demo-wetting-simulation-onion-a' },
    update: { irrigationMinutes: 30, resultJson: { demo: true, expectedMoistureIncrease: 8 } },
    create: { id: 'demo-wetting-simulation-onion-a', tenantId, farmId, fieldId: 'demo-field-onion-a', designId, cropType: '洋葱', soilType: 'loam', emitterFlowRate: 1.6, irrigationMinutes: 30, surfaceWettingRange: 0.28, rootZoneWettingRange: 0.42, deepPercolationRisk: 'LOW', resultJson: { demo: true, expectedMoistureIncrease: 8 } }
  });
}

async function seedRotation(client: PrismaClient, designId: string, valveDeviceId: string) {
  const group = await client.irrigationRotationGroup.upsert({
    where: { id: 'demo-rotation-group-onion-a' },
    update: { tenantId, farmId, fieldId: 'demo-field-onion-a', irrigationDesignId: designId, status: 'ACTIVE', targetPressureKpa: 180, targetFlowRate: 42 },
    create: { id: 'demo-rotation-group-onion-a', tenantId, farmId, name: '洋葱A区轮灌组', fieldId: 'demo-field-onion-a', irrigationDesignId: designId, status: 'ACTIVE', targetPressureKpa: 180, targetFlowRate: 42, metadata: { demo: true } }
  });
  await client.irrigationRotationValve.upsert({
    where: { id: 'demo-rotation-valve-onion-a' },
    update: { deviceId: valveDeviceId, fieldId: 'demo-field-onion-a', targetOpeningPercent: 65, maxIrrigationMinutes: 45 },
    create: { id: 'demo-rotation-valve-onion-a', groupId: group.id, deviceId: valveDeviceId, fieldId: 'demo-field-onion-a', valveOrder: 1, targetOpeningPercent: 65, maxIrrigationMinutes: 45 }
  });
  await client.irrigationRotationSchedule.upsert({
    where: { id: 'demo-rotation-schedule-onion-a' },
    update: { scheduleJson: { demo: true, days: ['MON', 'WED', 'FRI'], startAt: '06:30', durationMinutes: 30 }, isActive: true },
    create: { id: 'demo-rotation-schedule-onion-a', tenantId, farmId, groupId: group.id, name: '洋葱A区晨间轮灌', scheduleJson: { demo: true, days: ['MON', 'WED', 'FRI'], startAt: '06:30', durationMinutes: 30 }, isActive: true }
  });
  await client.irrigationRotationRun.upsert({
    where: { id: 'demo-rotation-run-onion-a' },
    update: { status: 'RUNNING', resultJson: { demo: true, stage: 'demo running' } },
    create: { id: 'demo-rotation-run-onion-a', tenantId, farmId, groupId: group.id, scheduleId: 'demo-rotation-schedule-onion-a', status: 'RUNNING', startedAt: new Date(now.getTime() - 20 * 60 * 1000), resultJson: { demo: true, stage: 'demo running' } }
  });
  return group.id;
}

async function seedFertigation(client: PrismaClient, rotationGroupId: string, fertigationDeviceId: string) {
  const tank = await client.fertilizerTank.upsert({
    where: { id: 'demo-fertilizer-tank-a' },
    update: { tenantId, farmId, deviceId: fertigationDeviceId, currentLevelL: 420, status: 'ACTIVE' },
    create: { id: 'demo-fertilizer-tank-a', tenantId, farmId, name: '洋葱A区 NPK 肥料罐', deviceId: fertigationDeviceId, capacityL: 600, currentLevelL: 420, fertilizerType: 'NPK 18-18-18', status: 'ACTIVE' }
  });
  const recipe = await client.fertigationRecipe.upsert({
    where: { id: 'demo-fertigation-recipe-onion-a' },
    update: { recipeJson: { demo: true, fertilizer: 'NPK 18-18-18', concentrationPercent: 0.2 }, recommendedDurationMinutes: 25, isActive: true },
    create: { id: 'demo-fertigation-recipe-onion-a', tenantId, farmId, cropType: '洋葱', cropStage: 'GROWING', name: '洋葱膨大期水肥处方 Demo', recipeJson: { demo: true, fertilizer: 'NPK 18-18-18', concentrationPercent: 0.2 }, recommendedDurationMinutes: 25, isActive: true }
  });
  await client.fertigationTask.upsert({
    where: { id: 'demo-fertigation-task-onion-a' },
    update: { status: 'QUEUED', durationMinutes: 25, targetWaterVolume: 45, targetFertilizerVolume: 18, resultJson: { demo: true } },
    create: { id: 'demo-fertigation-task-onion-a', tenantId, farmId, fieldId: 'demo-field-onion-a', rotationGroupId, tankId: tank.id, recipeId: recipe.id, status: 'QUEUED', durationMinutes: 25, targetWaterVolume: 45, targetFertilizerVolume: 18, resultJson: { demo: true } }
  });
}

async function seedDroneOperation(client: PrismaClient, boundaryId: string) {
  await client.droneImportJob.upsert({
    where: { id: 'demo-drone-import-job-onion-a' },
    update: { status: 'PARSED', parsedJson: { demo: true, source: 'samples/drone/onion-field-a.kml' } },
    create: { id: 'demo-drone-import-job-onion-a', tenantId, farmId, fieldId: 'demo-field-onion-a', source: 'KML', fileName: 'onion-field-a.kml', fileType: 'KML', status: 'PARSED', parsedJson: { demo: true, source: 'samples/drone/onion-field-a.kml' } }
  });
  const operation = await client.droneOperation.upsert({
    where: { id: 'demo-drone-operation-onion-a' },
    update: { status: 'REVIEWED', actualAreaMu: 296.4, coverageRate: 0.988, missedAreaMu: 3.6, routeGeoJson: onionRoute, coverageGeoJson: onionPolygon },
    create: {
      id: 'demo-drone-operation-onion-a',
      tenantId,
      farmId,
      fieldId: 'demo-field-onion-a',
      fieldBoundaryId: boundaryId,
      droneBrand: 'DJI',
      droneModel: 'DJI Agras T50',
      operationType: 'SPRAYING',
      source: 'KML',
      sourceFileName: 'onion-field-a.kml',
      coordinateSystem: 'WGS84',
      plannedAreaMu: 300,
      actualAreaMu: 296.4,
      coverageRate: 0.988,
      overlapRate: 0.96,
      missedAreaMu: 3.6,
      repeatedAreaMu: 1.2,
      flightDistanceM: 8200,
      flightDurationS: 1800,
      sprayVolumeL: 92,
      chemicalName: '洋葱叶面肥 Demo',
      dosagePerMu: 0.31,
      routeGeoJson: onionRoute,
      coverageGeoJson: onionPolygon,
      rawJson: { demo: true, source: 'samples/drone/onion-field-a.kml', statistics: { fieldAreaMu: 300 } },
      status: 'REVIEWED',
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 90 * 60 * 1000)
    }
  });
  await client.droneOperationReview.upsert({
    where: { id: 'demo-drone-review-onion-a' },
    update: { status: 'APPROVED', correctedFieldId: 'demo-field-onion-a', correctedFieldBoundaryId: boundaryId, confirmedAreaMu: 296.4, confirmedCoverageRate: 0.988, confirmedMissedAreaMu: 3.6, confirmedRepeatedAreaMu: 1.2, reviewedAt: now },
    create: { id: 'demo-drone-review-onion-a', tenantId, farmId, droneOperationId: operation.id, status: 'APPROVED', reviewerId: 'demo-user', reviewNote: 'P11.7 demo baseline approved', correctedFieldId: 'demo-field-onion-a', correctedFieldBoundaryId: boundaryId, confirmedAreaMu: 296.4, confirmedCoverageRate: 0.988, confirmedMissedAreaMu: 3.6, confirmedRepeatedAreaMu: 1.2, reviewedAt: now }
  });
  await client.mapLayer.upsert({
    where: { id: 'demo-layer-drone-route-onion-a' },
    update: { geoJson: onionRoute, styleJson: { demo: true, droneOperationId: operation.id, operationType: 'SPRAYING', layerRole: 'DRONE_ROUTE' } },
    create: { id: 'demo-layer-drone-route-onion-a', tenantId, farmId, name: '洋葱A区无人机航线 Demo', type: 'DRONE_ROUTE', source: 'DRONE_OPERATION_IMPORT', coordinateSystem: 'WGS84', geoJson: onionRoute, styleJson: { demo: true, droneOperationId: operation.id, operationType: 'SPRAYING', layerRole: 'DRONE_ROUTE' }, isVisible: true }
  });
  await client.mapLayer.upsert({
    where: { id: 'demo-layer-drone-coverage-onion-a' },
    update: { geoJson: onionPolygon, styleJson: { demo: true, droneOperationId: operation.id, operationType: 'SPRAYING', layerRole: 'DRONE_COVERAGE' } },
    create: { id: 'demo-layer-drone-coverage-onion-a', tenantId, farmId, name: '洋葱A区无人机覆盖区 Demo', type: 'ORTHOMOSAIC', source: 'DRONE_OPERATION_IMPORT', coordinateSystem: 'WGS84', geoJson: onionPolygon, styleJson: { demo: true, droneOperationId: operation.id, operationType: 'SPRAYING', layerRole: 'DRONE_COVERAGE' }, isVisible: true }
  });
  await client.operationReport.upsert({
    where: { id: 'demo-operation-report-drone-onion-a' },
    update: { summaryJson: { demo: true, fieldId: 'demo-field-onion-a', operationCostSummary: { totalAmount: 3080, currency: 'CNY' } }, metricsJson: { actualAreaMu: 296.4, coverageRate: 0.988, sprayVolumeL: 92 } },
    create: { id: 'demo-operation-report-drone-onion-a', tenantId, farmId, type: 'DRONE_SPRAYING', refId: operation.id, title: '洋葱A区无人机喷洒作业报告 Demo', summaryJson: { demo: true, fieldId: 'demo-field-onion-a', operationCostSummary: { totalAmount: 3080, currency: 'CNY' }, mapLayerIds: ['demo-layer-drone-route-onion-a', 'demo-layer-drone-coverage-onion-a'] }, metricsJson: { actualAreaMu: 296.4, coverageRate: 0.988, missedAreaMu: 3.6, repeatedAreaMu: 1.2, flightDistanceM: 8200, flightDurationS: 1800, sprayVolumeL: 92, dosagePerMu: 0.31 } }
  });
  return operation.id;
}

async function seedBusinessRecords(client: PrismaClient, droneOperationId: string) {
  const costs = [
    ['demo-cost-pesticide', 'PESTICIDE', 1280, 92, 'L', '洋葱叶面肥 Demo'],
    ['demo-cost-fertilizer', 'FERTILIZER', 960, 18, 'L', 'NPK 水肥 Demo'],
    ['demo-cost-drone-service', 'DRONE_SERVICE', 1800, 296.4, 'mu', '无人机喷洒服务 Demo'],
    ['demo-cost-labor', 'LABOR', 420, 6, 'hour', '人工巡田 Demo']
  ] as const;
  for (const [id, category, amount, quantity, unit, note] of costs) {
    await client.operationCost.upsert({
      where: { id },
      update: { amount, quantity, unit, note },
      create: { id, tenantId, farmId, fieldId: 'demo-field-onion-a', refType: category === 'DRONE_SERVICE' || category === 'PESTICIDE' ? 'DroneOperation' : 'DemoOperation', refId: category === 'DRONE_SERVICE' || category === 'PESTICIDE' ? droneOperationId : id, category, amount, currency: 'CNY', quantity, unit, unitPrice: amount / quantity, note }
    });
  }
  const observations = [
    ['demo-health-scouting-1', 'DRONE_SCOUTING', 'UNKNOWN', 'REVIEW', '无人机巡田观察：洋葱长势整体均匀'],
    ['demo-health-pest-1', 'MANUAL', 'PEST', 'LOW', '田边发现少量虫害迹象'],
    ['demo-health-water-stress-1', 'SENSOR', 'WATER_STRESS', 'MEDIUM', '下午土壤湿度偏低，建议关注']
  ] as const;
  for (const [id, source, type, severity, title] of observations) {
    await client.cropHealthObservation.upsert({
      where: { id },
      update: { source, type, severity, title, metadata: { demo: true } },
      create: { id, tenantId, farmId, fieldId: 'demo-field-onion-a', droneOperationId: source === 'DRONE_SCOUTING' ? droneOperationId : null, source, type, severity, title, description: 'P11.7 demo baseline', locationGeoJson: onionPolygon, metadata: { demo: true } }
    });
  }
  const factors = [
    ['demo-yield-factor-irrigation', 'IRRIGATION', 'IrrigationRotationRun', 'demo-rotation-run-onion-a'],
    ['demo-yield-factor-fertigation', 'FERTIGATION', 'FertigationTask', 'demo-fertigation-task-onion-a'],
    ['demo-yield-factor-drone', 'DRONE_SPRAYING', 'DroneOperation', droneOperationId],
    ['demo-yield-factor-pest', 'PEST_DISEASE', 'CropHealthObservation', 'demo-health-pest-1']
  ] as const;
  for (const [id, factorType, refType, refId] of factors) {
    await client.yieldFactor.upsert({
      where: { id },
      update: { valueJson: { demo: true, baseline: true } },
      create: { id, tenantId, farmId, fieldId: 'demo-field-onion-a', cropSeason: '2026-spring', factorType, refType, refId, valueJson: { demo: true, baseline: true } }
    });
  }
  await client.yieldRecord.upsert({
    where: { id: 'demo-yield-record-onion-a' },
    update: { yieldKg: 210000, areaMu: 300, yieldPerMu: 700 },
    create: { id: 'demo-yield-record-onion-a', tenantId, farmId, fieldId: 'demo-field-onion-a', cropType: '洋葱', cropSeason: '2026-spring', yieldKg: 210000, areaMu: 300, yieldPerMu: 700, source: 'demo baseline', metadata: { demo: true, forecast: false } }
  });
}

async function seedActivities(client: PrismaClient, droneOperationId: string) {
  const activities = [
    ['demo-activity-import', 'DRONE_OPERATION_IMPORTED', '无人机作业数据已导入', 'DroneOperation', droneOperationId],
    ['demo-activity-review', 'DRONE_OPERATION_REVIEWED', '无人机喷洒作业已审核', 'DroneOperation', droneOperationId],
    ['demo-activity-rotation', 'ROTATION_STARTED', '洋葱A区轮灌任务运行中', 'IrrigationRotationRun', 'demo-rotation-run-onion-a'],
    ['demo-activity-fertigation', 'FERTIGATION_STARTED', '水肥任务已进入队列', 'FertigationTask', 'demo-fertigation-task-onion-a'],
    ['demo-activity-alert', 'SENSOR_ALERT', '土壤湿度偏低风险提醒', 'SensorRecord', 'demo-soil-moisture-23']
  ] as const;
  for (const [id, type, title, refType, refId] of activities) {
    await client.farmActivity.upsert({
      where: { id },
      update: { title, metadata: { demo: true } },
      create: { id, tenantId, farmId, fieldId: 'demo-field-onion-a', type, title, description: 'P11.7 demo baseline', refType, refId, metadata: { demo: true } }
    });
  }
}

async function seedP12ProductionSkeleton(client: PrismaClient, droneOperationId: string) {
  const aiItems = [
    ['demo-ai-irrigation-low-moisture', 'IRRIGATION', 'MEDIUM', '洋葱A区湿度偏低，建议人工确认灌溉', { soilMoisture: 31, thresholdMin: 35 }, { type: 'IRRIGATION_ADVICE_ONLY' }],
    ['demo-ai-pressure-flow-normal', 'PRESSURE_FLOW', 'LOW', '压力/流量运行正常', { pressureKpa: 180, flowRateM3h: 42 }, { type: 'CONTINUE_MONITORING' }],
    ['demo-ai-drone-coverage-good', 'DRONE_COVERAGE', 'LOW', '无人机喷洒覆盖率良好', { droneOperationId, coverageRate: 0.988 }, { type: 'REPORT_ONLY' }],
    ['demo-ai-fertigation-tank', 'FERTIGATION', 'MEDIUM', '肥料罐液位需要关注', { fertilizerTankLevelL: 88 }, { type: 'CHECK_FERTILIZER_TANK' }],
    ['demo-ai-cost-risk', 'COST_RISK', 'LOW', '成本投入进入复盘区间', { costTotal: 4460 }, { type: 'REVIEW_COST_REPORT' }],
    ['demo-ai-yield-factor', 'YIELD_FACTOR', 'LOW', '产量影响因素已更新', { factorTypes: ['IRRIGATION', 'FERTIGATION', 'DRONE_SPRAYING'] }, { type: 'TRACK_YIELD_FACTOR' }]
  ] as const;

  for (const [id, type, severity, title, evidenceJson, recommendedActionJson] of aiItems) {
    await (client as any).aIRecommendation.upsert({
      where: { id },
      update: { type, severity, title, evidenceJson, recommendedActionJson, status: 'ACTIVE' },
      create: {
        id,
        tenantId,
        farmId,
        fieldId: 'demo-field-onion-a',
        type,
        severity,
        status: 'ACTIVE',
        title,
        summary: title,
        explanation: 'P12 demo baseline：仅生成农业建议，不自动执行开泵、开阀或无人机控制。',
        evidenceJson,
        recommendedActionJson,
        source: 'demo_seed',
        confidence: 0.72
      }
    });
  }

  await (client as any).deviceInstallationCheck.upsert({
    where: { id: 'demo-installer-check-valve-001' },
    update: { status: 'PASSED', telemetryOk: true, signalOk: true, batteryOk: true, bindingOk: true, checkedAt: now },
    create: {
      id: 'demo-installer-check-valve-001',
      tenantId,
      farmId,
      fieldId: 'demo-field-onion-a',
      deviceId: 'demo-valve-001',
      thingsboardDeviceId: 'tb-demo-valve-001',
      deviceCode: 'FARM-demo-FIELD-A-VALVE-001',
      deviceType: 'ELECTRIC_VALVE',
      installerName: 'Demo Installer',
      status: 'PASSED',
      telemetryOk: true,
      signalOk: true,
      batteryOk: true,
      rpcTestOk: false,
      bindingOk: true,
      notes: 'P12 demo installer baseline',
      checkedAt: now
    }
  });

  await (client as any).edgeGateway.upsert({
    where: { code: 'EDGE-demo-001' },
    update: { tenantId, farmId, status: 'OFFLINE', metadata: { demo: true } },
    create: { id: 'demo-edge-gateway-001', tenantId, farmId, name: 'Demo Edge Gateway', code: 'EDGE-demo-001', status: 'OFFLINE', metadata: { demo: true, skeleton: true } }
  });

  await (client as any).edgeDeviceBinding.upsert({
    where: { gatewayId_deviceId: { gatewayId: 'demo-edge-gateway-001', deviceId: 'demo-valve-001' } },
    update: { tenantId, farmId, localAddress: 'modbus://1', protocol: 'MODBUS_RTU', metadata: { demo: true } },
    create: { id: 'demo-edge-binding-valve-001', tenantId, farmId, gatewayId: 'demo-edge-gateway-001', deviceId: 'demo-valve-001', localAddress: 'modbus://1', protocol: 'MODBUS_RTU', metadata: { demo: true } }
  });

  await (client as any).bluetoothSession.upsert({
    where: { sessionCode: 'DEMO-BLE-SESSION' },
    update: { tenantId, farmId, userId: 'demo-user', status: 'ACTIVE', expiresAt: new Date(now.getTime() + 30 * 60 * 1000) },
    create: { id: 'demo-bluetooth-session-001', tenantId, farmId, userId: 'demo-user', deviceId: 'demo-valve-001', sessionCode: 'DEMO-BLE-SESSION', status: 'ACTIVE', allowedOperations: ['READ_DEVICE_INFO', 'READ_STATUS', 'MAINTENANCE_CHECK'], expiresAt: new Date(now.getTime() + 30 * 60 * 1000) }
  });
}

async function seedValveDryRunBaseline(client: PrismaClient, valveDeviceId: string) {
  const commandId = 'demo-valve-dry-run-test-open-001';
  const decision = await (client as any).decisionRecord.upsert({
    where: { id: 'demo-decision-valve-dry-run-001' },
    update: {
      tenantId,
      fieldId: 'demo-field-onion-a',
      status: 'PLANNED',
      metadata: { demo: true, p13_2: true, commandId }
    },
    create: {
      id: 'demo-decision-valve-dry-run-001',
      tenantId,
      fieldId: 'demo-field-onion-a',
      decisionType: 'DEVICE_HEALTH',
      recommendation: 'CHECK_DEVICE',
      confidence: 1,
      reason: 'P13.2 demo valve dry-run baseline',
      status: 'PLANNED',
      metadata: { demo: true, p13_2: true, commandId }
    }
  });
  const actionPlan = await (client as any).actionPlan.upsert({
    where: { id: 'demo-action-plan-valve-dry-run-001' },
    update: {
      tenantId,
      decisionId: decision.id,
      fieldId: 'demo-field-onion-a',
      status: 'EXECUTED',
      actions: [{ type: 'VALVE_CONTROL', command: 'TEST_OPEN', deviceId: valveDeviceId, commandId }],
      safety: { allowed: true, dryRun: true, reasons: [] }
    },
    create: {
      id: 'demo-action-plan-valve-dry-run-001',
      tenantId,
      decisionId: decision.id,
      fieldId: 'demo-field-onion-a',
      status: 'EXECUTED',
      actions: [{ type: 'VALVE_CONTROL', command: 'TEST_OPEN', deviceId: valveDeviceId, commandId }],
      safety: { allowed: true, dryRun: true, reasons: [] }
    }
  });
  await (client as any).deviceCommand.upsert({
    where: { requestId: commandId },
    update: {
      tenantId,
      deviceId: valveDeviceId,
      command: 'TEST_OPEN',
      status: 'ACKED',
      payload: { demo: true, dryRun: true, commandId, valveStatus: 'CLOSED', valveOpeningPercent: 0 },
      mqttTopic: 'agrios/demo/demo/devices/demo-valve-001/commands',
      sentAt: now,
      ackAt: now,
      errorMessage: null
    },
    create: {
      id: 'demo-device-command-valve-dry-run-001',
      tenantId,
      deviceId: valveDeviceId,
      command: 'TEST_OPEN',
      payload: { demo: true, dryRun: true, commandId, valveStatus: 'CLOSED', valveOpeningPercent: 0 },
      status: 'ACKED',
      mqttTopic: 'agrios/demo/demo/devices/demo-valve-001/commands',
      requestId: commandId,
      sentAt: now,
      ackAt: now
    }
  });
  await (client as any).actionExecution.upsert({
    where: { id: 'demo-action-execution-valve-dry-run-001' },
    update: {
      tenantId,
      actionPlanId: actionPlan.id,
      deviceId: valveDeviceId,
      command: 'VALVE_TEST_OPEN',
      status: 'ACKED',
      requestId: commandId,
      result: { demo: true, dryRun: true, commandId },
      executedAt: now,
      feedbackAt: now,
      feedback: { status: 'ACKED', valveStatus: 'CLOSED', valveOpeningPercent: 0 }
    },
    create: {
      id: 'demo-action-execution-valve-dry-run-001',
      tenantId,
      actionPlanId: actionPlan.id,
      deviceId: valveDeviceId,
      command: 'VALVE_TEST_OPEN',
      status: 'ACKED',
      requestId: commandId,
      result: { demo: true, dryRun: true, commandId },
      executedAt: now,
      feedbackAt: now,
      feedback: { status: 'ACKED', valveStatus: 'CLOSED', valveOpeningPercent: 0 }
    }
  });
  const existingEvent = await (client as any).eventLog.findFirst({
    where: { eventType: 'valve.demo.dry_run.seeded', entityId: valveDeviceId }
  });
  if (!existingEvent) {
    await (client as any).eventLog.create({
      data: {
        tenantId,
        farmId,
        eventType: 'valve.demo.dry_run.seeded',
        entityType: 'Device',
        entityId: valveDeviceId,
        severity: 'INFO',
        payload: { commandId, dryRun: true }
      }
    });
  }
}

if (require.main === module) {
  seedDemoFarm()
    .then((result) => {
      console.log('Demo farm seeded:', result);
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
