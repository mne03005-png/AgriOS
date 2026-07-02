import { request } from './http';
import { defaultFarmId, mockAlerts, mockCockpit, mockFieldDetail, mockMap, mockOperations, mockRecommendations, mockReports } from './mock-data';

export const getCockpit = (farmId = defaultFarmId) => request(`/mobile/cockpit?farmId=${farmId}`, {}, mockCockpit);
export const getMap = (farmId = defaultFarmId) => request(`/mobile/map?farmId=${farmId}`, {}, mockMap);
export const getFieldDetail = (fieldId: string) => request(`/mobile/fields/${fieldId}/detail`, {}, mockFieldDetail);
export const getAIRecommendations = (farmId = defaultFarmId) => request(`/mobile/ai/recommendations?farmId=${farmId}`, {}, mockRecommendations);
export const getOperations = (farmId = defaultFarmId) => request(`/mobile/operations?farmId=${farmId}`, {}, mockOperations);
export const emergencyStop = (farmId = defaultFarmId) =>
  request('/mobile/control/emergency-stop', { method: 'POST', body: JSON.stringify({ farmId }) }, { ok: true, message: 'Emergency stop requested' });
export const controlValve = (payload: { deviceId: string; command: 'VALVE_OPEN' | 'VALVE_CLOSE'; remark?: string }) =>
  request('/mobile/control/valve', { method: 'POST', body: JSON.stringify(payload) }, { ok: true, payload });
export const getAlerts = (farmId = defaultFarmId) => request(`/mobile/alerts?farmId=${farmId}`, {}, mockAlerts);
export const getReportsSummary = (farmId = defaultFarmId) => request(`/mobile/reports/summary?farmId=${farmId}`, {}, mockReports);
