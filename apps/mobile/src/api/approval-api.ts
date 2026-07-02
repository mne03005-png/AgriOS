import { request } from './http';

export const approve = (id: string) => request(`/approvals/${id}/approve`, { method: 'POST' }, { id, status: 'APPROVED' });
export const reject = (id: string, reason?: string) => request(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, { id, status: 'REJECTED' });
