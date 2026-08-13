export const defaultFarmId = 'demo';
export const defaultFieldId = 'demo-field-onion-a';

export const mockDroneOperations = [
  {
    id: 'drone_001',
    droneModel: 'DJI Agras T50',
    operationType: 'SPRAYING',
    actualAreaMu: 296.4,
    coverageRate: 96.8,
    missedAreaMu: 3.6,
    repeatedAreaMu: 1.2,
    flightDistanceM: 8200,
    flightDurationS: 1800,
    sprayVolumeL: 92,
    dosagePerMu: 0.31,
    status: 'LINKED',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString()
  },
  {
    id: 'drone_002',
    droneModel: 'DJI Mavic 3M',
    operationType: 'MAPPING',
    actualAreaMu: 300,
    coverageRate: 99,
    missedAreaMu: 0,
    repeatedAreaMu: 0,
    flightDistanceM: 6300,
    flightDurationS: 1500,
    status: 'REVIEWED',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString()
  }
];

export const mockCockpit = {
  farm: { id: defaultFarmId, name: '示范洋葱农场', fields: [{ id: defaultFieldId, name: '洋葱地块 A' }] },
  weather: { summary: '晴，31℃，东南风' },
  deviceOnlineRate: 86,
  autoModeStatus: { enabled: false, policy: 'assisted' },
  todayRiskLevel: 'NORMAL',
  activeIrrigationZones: 1,
  todayWaterUsage: 1280,
  pendingAlerts: 2,
  pressureSummary: { avgKpa: 182, latest: { pressureKpa: 188, reportedAt: new Date().toISOString() } },
  flowSummary: { avgM3h: 12.4, latest: { flowRateM3h: 12.8, reportedAt: new Date().toISOString() } },
  pumpStatus: [{ deviceId: 'pump_001', status: 'RUNNING', reportedAt: new Date().toISOString() }],
  fertigationStatus: [{ id: 'fert_001', status: 'QUEUED', durationMinutes: 45 }],
  tankLevelWarnings: [{ deviceId: 'tank_001', fertilizerTankLevelL: 12 }],
  activeRotationRuns: [{ id: 'rotation_run_001', status: 'RUNNING' }],
  latestActivities: [
    { id: 'activity_001', type: 'ROTATION_STARTED', title: '轮灌已开始', createdAt: new Date().toISOString() },
    { id: 'activity_002', type: 'DRONE_OPERATION_IMPORTED', title: '无人机喷洒作业已导入', createdAt: new Date().toISOString() }
  ],
  latestDecision: { recommendation: 'SHOULD_IRRIGATE', reason: '土壤湿度低于洋葱生长所需目标值。', confidence: 0.82 },
  latestActionPlans: [{ id: 'plan_001', status: 'PENDING_APPROVAL', safety: { warnings: ['需要人工确认'] } }],
  droneOperations: mockDroneOperations,
  miniMapLayers: [{ id: 'layer_001', name: '洋葱地块 A', type: 'FIELD' }],
  quickActions: { emergencyStop: true, manualValve: true, autoMode: false, alerts: true }
};

export const mockMap = {
  fieldBoundaries: [{ id: 'boundary_001', fieldId: defaultFieldId, name: '洋葱地块 A', status: 'APPROVED', areaMu: 300 }],
  irrigationZones: [{ id: 'zone_001', name: '1 号轮灌区' }],
  valveMarkers: [{ id: 'valve_001', name: '阀门 A1', online: true }],
  sensorMarkers: [{ id: 'sensor_001', name: '土壤湿度传感器', online: true }],
  pumpMarkers: [{ id: 'pump_001', name: '水泵控制器', online: true }],
  pressureSensors: [{ id: 'pressure_001', name: '主压力传感器', online: true }],
  flowMeters: [{ id: 'flow_001', name: '主流量计', online: true }],
  fertigationDevices: [{ id: 'fert_dev_001', name: '水肥一体机', online: true }],
  fertilizerTanks: [{ id: 'tank_001', name: 'NPK 肥料罐', currentLevelL: 120 }],
  rotationGroups: [{ id: 'rotation_group_001', name: '东区轮灌组' }],
  waterChannels: [],
  pipelines: [],
  obstacles: [],
  droneRoutes: [],
  droneOperations: mockDroneOperations,
  droneRouteLayers: [{
    id: 'drone_route_001',
    name: '无人机航线',
    type: 'DRONE_ROUTE',
    geoJson: { type: 'LineString', coordinates: [[118.09, 36.705], [118.13, 36.715], [118.1, 36.735]] },
    styleJson: { droneOperationId: 'drone_001', operationType: 'SPRAYING', layerRole: 'DRONE_ROUTE' }
  }],
  droneCoverageLayers: [{
    id: 'drone_coverage_001',
    name: '喷洒覆盖范围',
    type: 'ORTHOMOSAIC',
    geoJson: { type: 'Polygon', coordinates: [[[118.095, 36.7], [118.13, 36.702], [118.126, 36.736], [118.094, 36.734], [118.095, 36.7]]] },
    styleJson: { droneOperationId: 'drone_001', operationType: 'SPRAYING', layerRole: 'DRONE_COVERAGE' }
  }],
  prescriptionLayers: [{
    id: 'prescription_001',
    name: '处方图层',
    type: 'ORTHOMOSAIC',
    geoJson: { type: 'Polygon', coordinates: [[[118.1, 36.705], [118.12, 36.705], [118.12, 36.725], [118.1, 36.725], [118.1, 36.705]]] },
    styleJson: { droneOperationId: 'drone_002', operationType: 'MAPPING', layerRole: 'PRESCRIPTION_OR_ORTHOMOSAIC' }
  }],
  gpsTracks: [],
  orthomosaicLayers: []
};

export const mockFieldDetail = {
  field: { id: defaultFieldId, farmId: defaultFarmId, name: '洋葱地块 A', areaMu: 300, soilType: 'loam' },
  boundary: mockMap.fieldBoundaries[0],
  cropType: 'onion',
  cropStage: 'GROWING',
  soilType: 'loam',
  latestMoisture: { value: 32, reportedAt: new Date().toISOString() },
  moistureTrend: [35, 34, 32, 31, 33],
  irrigationHistory: [{ id: 'irr_001', status: 'FINISHED', waterAmount: 1200 }],
  aiRecommendation: mockCockpit.latestDecision,
  valveStatus: mockMap.valveMarkers,
  sensorStatus: mockMap.sensorMarkers,
  droneOperationRecords: mockDroneOperations,
  droneOperationReviews: [{ id: 'review_001', status: 'PENDING', droneOperationId: 'drone_001', confirmedCoverageRate: 96.8 }],
  operationCostSummary: { totalAmount: 0, currency: 'CNY', byCategory: { DRONE_SERVICE: 0, PESTICIDE: 0 }, count: 2 },
  cropHealthObservations: [{ id: 'health_001', type: 'UNKNOWN', severity: 'REVIEW', title: '无人机巡田数据占位' }],
  yieldFactors: [{ id: 'yield_factor_001', factorType: 'DRONE_SPRAYING', refType: 'DroneOperation', refId: 'drone_001' }],
  latestOperationReports: [{ id: 'report_drone_001', type: 'DRONE_SPRAYING', title: '无人机喷洒作业报告' }],
  latestDroneSprayingReport: { id: 'report_drone_001', type: 'DRONE_SPRAYING' },
  latestMappingLayer: mockMap.prescriptionLayers[0],
  cropIrrigationRecipe: { targetMoistureMin: 38, targetMoistureMax: 58, recommendedIrrigationMinutes: 30 },
  wettingSimulationPreview: { deepPercolationRisk: 'LOW', expectedMoistureIncrease: 8, recommendedDuration: 30 },
  latestDesign: { name: '洋葱滴灌方案', status: 'CHECKED' },
  latestHydraulicCheck: { isPassed: true, endPressure: 1.3 }
};

export const mockRecommendations = [
  {
    id: 'decision_001',
    recommendation: 'SHOULD_IRRIGATE',
    reason: '土壤湿度偏低，建议灌溉 30 分钟。',
    confidenceScore: 0.82,
    riskLevel: 'LOW',
    expectedWaterUsage: 1200,
    expectedMoistureIncrease: 8,
    approvalRequired: true,
    actionPlans: mockCockpit.latestActionPlans
  }
];

export const mockOperations = {
  actionPlans: [
    { id: 'plan_001', status: 'PENDING_APPROVAL', decision: mockRecommendations[0], executions: [] },
    { id: 'plan_000', status: 'EXECUTED', decision: { recommendation: 'STOP_IRRIGATION' }, executions: [{ status: 'ACKED' }] }
  ],
  rotationRuns: [{ id: 'rotation_run_001', status: 'RUNNING' }],
  fertigationTasks: [{ id: 'fert_001', status: 'QUEUED' }],
  dissolveTasks: [{ id: 'dissolve_001', status: 'SUCCESS' }],
  pumpOperations: [{ id: 'pump_op_001', status: 'FINISHED' }],
  droneMappingOperations: mockDroneOperations.filter((item) => item.operationType === 'MAPPING'),
  droneSprayingOperations: mockDroneOperations.filter((item) => item.operationType === 'SPRAYING'),
  droneSpreadingOperations: [],
  droneScoutingOperations: []
};

export const mockAlerts = {
  safetyAlerts: [
    { id: 'alert_001', severity: 'HIGH', message: '土壤湿度过低', fieldId: defaultFieldId, status: 'OPEN' },
    { id: 'alert_002', severity: 'MEDIUM', message: '手动阀门操作需要确认', fieldId: defaultFieldId, status: 'OPEN' }
  ],
  anomalies: [
    { id: 'anom_001', type: 'PRESSURE_DROP', severity: 'HIGH', message: '压力低于阈值', fieldId: defaultFieldId },
    { id: 'anom_002', type: 'TANK_LOW_LEVEL', severity: 'MEDIUM', message: '肥料罐液位过低', fieldId: defaultFieldId }
  ]
};

export const mockReports = {
  dailyWaterUsage: 1280,
  monthlyWaterUsage: 28600,
  waterPerMu: 4.2,
  deviceOnlineRate: 86,
  actionExecutionSuccessRate: 92,
  aiAdoptionRate: 64,
  irrigationVolumeSummary: { quantity: 1280, unit: 'm3' },
  fertigationTaskSummary: { total: 3, success: 2, blocked: 1 },
  pressureAnomalyCount: 1,
  flowAnomalyCount: 1,
  rotationExecutionSuccessRate: 88,
  droneOperationCount: 4,
  sprayingAreaTotal: 296.4,
  averageCoverageRate: 96.8,
  chemicalUsageTotal: 92,
  operationCostSummary: { totalAmount: 0, currency: 'CNY', byCategory: { DRONE_SERVICE: 0, PESTICIDE: 0 }, count: 2 },
  pesticideUsageSummary: { sprayVolumeL: 92, operationCount: 1 },
  droneServiceCostSummary: { totalAmount: 0, currency: 'CNY', byCategory: { DRONE_SERVICE: 0 }, count: 1 },
  cropHealthSummary: { total: 1, byType: { UNKNOWN: 1 } },
  yieldAnalysisSummary: { factorCount: 1, byFactorType: { DRONE_SPRAYING: 1 } },
  anomalyHandlingRecords: mockAlerts.safetyAlerts
};

export const mockDroneImportResult = {
  importJob: { id: 'import_job_001', status: 'PARSED' },
  operation: mockDroneOperations[0],
  mapLayers: []
};
