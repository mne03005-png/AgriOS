import { request } from './http';
import { defaultFarmId } from './mock-data';

export function getHealthReady() {
  return request('/health/ready', {}, {
    deviceControlMode: 'MOCK',
    deviceControlModeReady: true,
    thingsBoardConfigured: false,
    edgeControllerConfigured: false,
    bluetoothLocalEnabled: false,
    productionWarnings: []
  });
}

export function getInstallerChecks(farmId = defaultFarmId) {
  return request(`/installer/device-checks?farmId=${farmId}`, {}, []);
}

export function getEdgeGateways(farmId = defaultFarmId) {
  return request(`/edge-gateways?farmId=${farmId}`, {}, []);
}

export function getBluetoothSessions(farmId = defaultFarmId) {
  return request(`/bluetooth/sessions?farmId=${farmId}`, {}, []);
}

export function getAIRecommendationList(farmId = defaultFarmId) {
  return request(`/ai-recommendations?farmId=${farmId}`, {}, []);
}

export function getFarmTelemetrySummary(farmId = defaultFarmId) {
  return request(`/iot/farms/${farmId}/telemetry/summary`, {}, {
    pressureSummary: null,
    flowSummary: null,
    pumpStatus: [],
    valveStatus: [],
    tankLevelWarnings: []
  });
}

export function getLatestRealSensorTelemetry(farmId = defaultFarmId) {
  return request(`/iot/farms/${farmId}/telemetry/latest-real-sensor`, {}, {
    fallbackLabel: 'Demo fallback',
    sensorRecord: {
      deviceName: 'AGRIOS-TEST-SOIL-001',
      thingsboardDeviceId: 'node-red-soil-simulator-001',
      soilMoisture: 31.2,
      temperature: 22.5,
      humidity: 60,
      battery: 88,
      normalizedJson: {
        soilMoisture: 31.2,
        soilTemperature: 22.5,
        airHumidity: 60,
        batteryPercent: 88,
        signalStrength: -70
      },
      reportedAt: new Date().toISOString()
    },
    snapshot: {
      thingsboardDeviceId: 'node-red-soil-simulator-001',
      normalizedJson: {
        soilMoisture: 31.2,
        soilTemperature: 22.5,
        batteryPercent: 88,
        signalStrength: -70
      },
      reportedAt: new Date().toISOString()
    }
  });
}

export function getBindingCandidatesForThingsBoard(deviceName = 'AGRIOS-TEST-SOIL-001', thingsboardDeviceId = 'node-red-soil-simulator-001') {
  const params = new URLSearchParams();
  if (deviceName) params.set('deviceName', deviceName);
  if (thingsboardDeviceId) params.set('thingsboardDeviceId', thingsboardDeviceId);
  return request(`/iot/devices/binding-candidates?${params.toString()}`, {}, {
    fallbackLabel: 'Demo fallback',
    deviceName,
    thingsboardDeviceId,
    candidates: [],
    warnings: ['Using fallback binding candidate data.']
  });
}

export function getValveControlStatus(deviceId = 'demo-valve-001') {
  return request(`/device-control/valves/${deviceId}/status`, {}, {
    deviceId,
    deviceCode: 'demo-valve-001',
    online: true,
    valveStatus: 'CLOSED',
    valveOpeningPercent: 0,
    dryRun: true,
    realControlAllowed: false,
    feedbackRequired: true,
    latestCommand: null,
    latestExecution: null
  });
}

export function getValveCommands(deviceId = 'demo-valve-001') {
  return request(`/device-control/valves/${deviceId}/commands`, {}, []);
}

export function postValveTestOpen(deviceId = 'demo-valve-001', testDurationSeconds = 3, reason = '', reauthToken = '') {
  return request(`/device-control/valves/${deviceId}/test-open`, {
    method: 'POST',
    headers: { 'X-Reauth-Token': reauthToken },
    body: JSON.stringify({ dryRun: true, testDurationSeconds, reason })
  });
}

export function postValveClose(deviceId = 'demo-valve-001', reason = '', reauthToken = '') {
  return request(`/device-control/valves/${deviceId}/close`, {
    method: 'POST',
    headers: { 'X-Reauth-Token': reauthToken },
    body: JSON.stringify({ dryRun: true, reason })
  });
}

export function postValveSetOpening(deviceId = 'demo-valve-001', openingPercent = 5, reason = '', reauthToken = '') {
  return request(`/device-control/valves/${deviceId}/set-opening`, {
    method: 'POST',
    headers: { 'X-Reauth-Token': reauthToken },
    body: JSON.stringify({ dryRun: true, openingPercent, reason })
  });
}

export function getActionQueueJobs(farmId = defaultFarmId) {
  return request(`/action-queue/jobs?farmId=${farmId}&pageSize=5`, {}, []);
}

export function getEdgeCommands(farmId = defaultFarmId) {
  return request(`/edge-gateways/commands/list?farmId=${farmId}&pageSize=5`, {}, []);
}

export function getAuditEvents(farmId = defaultFarmId) {
  return request(`/audit/events?farmId=${farmId}&pageSize=5`, {}, []);
}
