import { request } from './http';
import { defaultFarmId, mockAlerts, mockCockpit, mockFieldDetail, mockMap, mockOperations, mockRecommendations, mockReports } from './mock-data';

export const getCockpit = (farmId = defaultFarmId) => request(`/mobile/cockpit?farmId=${farmId}`, {}, mockCockpit);
export const getMap = (farmId = defaultFarmId) => request(`/mobile/map?farmId=${farmId}`, {}, mockMap);
export const getFieldDetail = (fieldId: string) => request(`/mobile/fields/${fieldId}/detail`, {}, mockFieldDetail);
export const getAIRecommendations = (farmId = defaultFarmId) => request(`/mobile/ai/recommendations?farmId=${farmId}`, {}, mockRecommendations);
export const getOperations = (farmId = defaultFarmId) => request(`/mobile/operations?farmId=${farmId}`, {}, mockOperations);
export const getReadOnlyDevices = (pageSize = 50) => request(`/iot/devices?pageSize=${pageSize}`, {}, { items: [], total: 0 });
export const getReadOnlyDeviceHistory = (deviceId: string, range = '24h') => {
  const to = new Date();
  const from = new Date(to.getTime() - (range === '7d' ? 7 : 1) * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), pageSize: '200' });
  return request(`/iot/devices/${deviceId}/telemetry/history?${params.toString()}`, {}, { items: [], from, to });
};
export const getReadOnlyDeadLetters = () => request('/iot/dead-letters?pageSize=20', {}, { items: [], total: 0 });
export const emergencyStop = (farmId = defaultFarmId) =>
  request('/mobile/control/emergency-stop', { method: 'POST', body: JSON.stringify({ farmId }) }, { ok: false, code: 'READ_ONLY_MODE' });
export const controlValve = (payload: { deviceId: string; command: 'VALVE_OPEN' | 'VALVE_CLOSE'; remark?: string }) =>
  request('/mobile/control/valve', { method: 'POST', body: JSON.stringify(payload) }, { ok: false, code: 'READ_ONLY_MODE', payload });
export const getAlerts = (farmId = defaultFarmId) => request(`/mobile/alerts?farmId=${farmId}`, {}, mockAlerts);
export const getReportsSummary = (farmId = defaultFarmId) => request(`/mobile/reports/summary?farmId=${farmId}`, {}, mockReports);
