import { request } from './http';
import { defaultFarmId, mockDroneImportResult, mockDroneOperations } from './mock-data';

export const importDroneOperation = (payload: Record<string, unknown>) =>
  request('/drone-operations/import', { method: 'POST', body: JSON.stringify(payload) }, mockDroneImportResult);

export const importDroneOperationFile = (formData: FormData) =>
  request('/drone-operations/import-file', { method: 'POST', body: formData }, mockDroneImportResult);

export const getDroneOperations = (farmId = defaultFarmId, fieldId?: string) =>
  request(`/drone-operations?farmId=${farmId}${fieldId ? `&fieldId=${fieldId}` : ''}`, {}, mockDroneOperations);

export const getDroneOperation = (id: string) =>
  request(`/drone-operations/${id}`, {}, mockDroneOperations.find((item) => item.id === id) ?? mockDroneOperations[0]);

export const linkDroneOperationField = (id: string, payload: Record<string, unknown>) =>
  request(`/drone-operations/${id}/link-field`, { method: 'POST', body: JSON.stringify(payload) }, { ok: true, id, ...payload });

export const generateDroneOperationReport = (id: string) =>
  request(`/drone-operations/${id}/generate-report`, { method: 'POST' }, { id: `report_${id}`, type: 'DRONE_SPRAYING' });

export const getDroneImportJob = (id: string) =>
  request(`/drone-operations/import-jobs/${id}`, {}, mockDroneImportResult.importJob);
