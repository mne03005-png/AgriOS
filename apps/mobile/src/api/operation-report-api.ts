import { request } from './http';
import { defaultFarmId, mockReports } from './mock-data';

export const getOperationReports = (farmId = defaultFarmId) =>
  request(`/operation-reports?farmId=${farmId}`, {}, [{ id: 'report_drone_001', farmId, type: 'DRONE_SPRAYING', title: 'Drone spraying report', summaryJson: {}, metricsJson: mockReports }]);

export const getOperationReport = (id: string) =>
  request(`/operation-reports/${id}`, {}, { id, type: 'DRONE_SPRAYING', title: 'Drone spraying report', summaryJson: {}, metricsJson: mockReports });
