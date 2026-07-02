import { request } from './http';
import { defaultFarmId, mockDroneImportResult, mockDroneOperations } from './mock-data';

const mockReviews = [
  {
    id: 'review_001',
    farmId: defaultFarmId,
    droneOperationId: mockDroneOperations[0].id,
    status: 'PENDING',
    confirmedAreaMu: mockDroneOperations[0].actualAreaMu,
    confirmedCoverageRate: mockDroneOperations[0].coverageRate,
    confirmedMissedAreaMu: mockDroneOperations[0].missedAreaMu,
    confirmedRepeatedAreaMu: mockDroneOperations[0].repeatedAreaMu,
    operation: mockDroneOperations[0]
  }
];

export const getDroneReviews = (farmId = defaultFarmId, status?: string) =>
  request(`/drone-operations/reviews?farmId=${farmId}${status ? `&status=${status}` : ''}`, {}, mockReviews);

export const getDroneReview = (operationId: string) =>
  request(`/drone-operations/${operationId}/review`, {}, { review: mockReviews[0], operation: mockDroneOperations[0] });

export const approveDroneReview = (operationId: string, payload: Record<string, unknown> = {}) =>
  request(`/drone-operations/${operationId}/review/approve`, { method: 'POST', body: JSON.stringify(payload) }, { ...mockDroneImportResult, review: { ...mockReviews[0], status: 'APPROVED' } });

export const rejectDroneReview = (operationId: string, payload: Record<string, unknown> = {}) =>
  request(`/drone-operations/${operationId}/review/reject`, { method: 'POST', body: JSON.stringify(payload) }, { review: { ...mockReviews[0], status: 'REJECTED' } });

export const linkDroneReviewField = (operationId: string, payload: Record<string, unknown>) =>
  request(`/drone-operations/${operationId}/review/link-field`, { method: 'POST', body: JSON.stringify(payload) }, { review: mockReviews[0], operation: { ...mockDroneOperations[0], ...payload } });

export const updateDroneReviewCoverage = (operationId: string, payload: Record<string, unknown>) =>
  request(`/drone-operations/${operationId}/review/update-coverage`, { method: 'POST', body: JSON.stringify(payload) }, { review: mockReviews[0], operation: mockDroneOperations[0] });
