import { request } from './http';
import { defaultFarmId } from './mock-data';

const mockDemoHealth = {
  farmId: defaultFarmId,
  isReady: false,
  missingItems: ['backend'],
  warnings: ['Using mock fallback. Start backend and run npx prisma db seed.'],
  recommendedActions: ['Run npx prisma db seed from apps/backend.'],
  moduleStatus: {
    tenant: { ready: false, count: 0 },
    farm: { ready: false, count: 0 },
    mobileCockpit: { ready: false, count: 0 }
  }
};

export const getDemoHealth = (farmId = defaultFarmId) => request(`/demo/health?farmId=${farmId}`, {}, mockDemoHealth);
