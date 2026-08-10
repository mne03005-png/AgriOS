import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const password = process.env.PHASE5_PASSWORD;
if (!password || password.length < 12) throw new Error('PHASE5_PASSWORD must contain at least 12 characters');

const ids = {
  tenantA: 'phase5-tenant-a',
  tenantB: 'phase5-tenant-b',
  farmA: 'phase5-farm-a',
  farmB: 'phase5-farm-b',
  fieldA: 'phase5-field-a',
  fieldB: 'phase5-field-b',
  adminA: 'phase5-admin-a',
  viewerA: 'phase5-viewer-a',
  userB: 'phase5-user-b',
  deviceA: 'phase5-valve-a',
  decisionA: 'phase5-decision-a',
  planA: 'phase5-plan-a'
};

try {
  const existing = await prisma.user.count({ where: { id: { in: [ids.adminA, ids.viewerA, ids.userB] } } });
  const existingTenants = await prisma.tenant.count({ where: { id: { in: [ids.tenantA, ids.tenantB] } } });
  if (existing || existingTenants) throw new Error('refusing to overwrite existing Phase 5 fixtures');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.tenant.create({ data: { id: ids.tenantA, name: 'Phase 5 Tenant A', type: 'FARM_GROUP' } }),
    prisma.tenant.create({ data: { id: ids.tenantB, name: 'Phase 5 Tenant B', type: 'FARM_GROUP' } }),
    prisma.farm.create({ data: { id: ids.farmA, tenantId: ids.tenantA, name: 'Phase 5 Farm A', type: 'COMPANY' } }),
    prisma.farm.create({ data: { id: ids.farmB, tenantId: ids.tenantB, name: 'Phase 5 Farm B', type: 'COMPANY' } }),
    prisma.tenantFarm.create({ data: { tenantId: ids.tenantA, farmId: ids.farmA, role: 'OWNER' } }),
    prisma.tenantFarm.create({ data: { tenantId: ids.tenantB, farmId: ids.farmB, role: 'OWNER' } }),
    prisma.field.create({ data: { id: ids.fieldA, tenantId: ids.tenantA, farmId: ids.farmA, name: 'Phase 5 Field A', areaMu: 1 } }),
    prisma.field.create({ data: { id: ids.fieldB, tenantId: ids.tenantB, farmId: ids.farmB, name: 'Phase 5 Field B', areaMu: 1 } }),
    prisma.user.create({ data: { id: ids.adminA, tenantId: ids.tenantA, farmId: ids.farmA, phone: 'phase5-admin-a', email: 'phase5-admin-a@gray.invalid', name: 'Phase 5 Admin A', role: 'TENANT_ADMIN', passwordHash } }),
    prisma.user.create({ data: { id: ids.viewerA, tenantId: ids.tenantA, farmId: ids.farmA, phone: 'phase5-viewer-a', email: 'phase5-viewer-a@gray.invalid', name: 'Phase 5 Viewer A', role: 'VIEWER', passwordHash } }),
    prisma.user.create({ data: { id: ids.userB, tenantId: ids.tenantB, farmId: ids.farmB, phone: 'phase5-user-b', email: 'phase5-user-b@gray.invalid', name: 'Phase 5 User B', role: 'TENANT_ADMIN', passwordHash } }),
    prisma.device.create({ data: { id: ids.deviceA, tenantId: ids.tenantA, fieldId: ids.fieldA, code: 'phase5-valve-a', name: 'Phase 5 Mock Valve', type: 'VALVE', mqttTopic: 'agrios/phase5-tenant-a/phase5-farm-a/devices/phase5-valve-a' } }),
    prisma.decisionRecord.create({ data: { id: ids.decisionA, tenantId: ids.tenantA, fieldId: ids.fieldA, decisionType: 'DEVICE_HEALTH', recommendation: 'CHECK_DEVICE', confidence: 1, reason: 'Phase 5 BullMQ validation fixture' } }),
    prisma.actionPlan.create({ data: { id: ids.planA, tenantId: ids.tenantA, decisionId: ids.decisionA, fieldId: ids.fieldA, status: 'PLANNED', actions: [], safety: { phase5: true, mockOnly: true } } })
  ]);
  console.log(JSON.stringify({ created: true, ids, usersCreated: 3, tenantsCreated: 2, farmsCreated: 2, devicesCreated: 1 }));
} finally {
  await prisma.$disconnect();
}
