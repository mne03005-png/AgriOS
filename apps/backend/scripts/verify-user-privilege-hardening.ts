import * as assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from '../src/modules/user/user.service';

type Role = 'FARMER' | 'TENANT_ADMIN' | 'COOPERATIVE_ADMIN' | 'PLATFORM_ADMIN';

function makeRequestContext(input: { userId: string; tenantId?: string; role: Role }) {
  return {
    getUserId: () => input.userId,
    getTenantId: () => input.tenantId,
    getRole: () => input.role,
    isPlatformAdmin: () => input.role === 'PLATFORM_ADMIN'
  };
}

function makeTenantScope(requestContext: ReturnType<typeof makeRequestContext>) {
  return {
    requireTenantId: () => {
      const tenantId = requestContext.getTenantId();
      if (!tenantId && !requestContext.isPlatformAdmin()) throw new ForbiddenException('Tenant context is required');
      return tenantId;
    },
    where: (base: Record<string, unknown> = {}) => (requestContext.isPlatformAdmin() ? base : { ...base, tenantId: requestContext.getTenantId() })
  };
}

function makePrisma() {
  const calls: any[] = [];
  const users: Record<string, { id: string; tenantId: string | null }> = {
    'farmer-a': { id: 'farmer-a', tenantId: 'tenant-a' },
    'user-a': { id: 'user-a', tenantId: 'tenant-a' },
    'user-b': { id: 'user-b', tenantId: 'tenant-b' }
  };
  const farms: Record<string, { id: string; tenantId: string | null }> = {
    'farm-a': { id: 'farm-a', tenantId: 'tenant-a' },
    'farm-b': { id: 'farm-b', tenantId: 'tenant-b' }
  };
  return {
    calls,
    user: {
      findFirst: async ({ where }: any) => {
        calls.push({ model: 'user', action: 'findFirst', where });
        const user = users[where.id];
        if (!user) return null;
        if (where.tenantId !== undefined && user.tenantId !== where.tenantId) return null;
        return user;
      },
      update: async ({ where, data }: any) => {
        calls.push({ model: 'user', action: 'update', where, data });
        return { id: where.id, ...data };
      },
      create: async ({ data }: any) => {
        calls.push({ model: 'user', action: 'create', data });
        return { id: 'created-user', ...data };
      }
    },
    farm: {
      findFirst: async ({ where }: any) => {
        calls.push({ model: 'farm', action: 'findFirst', where });
        const farm = farms[where.id];
        if (!farm) return null;
        if (where.tenantId !== undefined && farm.tenantId !== where.tenantId) return null;
        return farm;
      }
    }
  };
}

function makeService(input: { userId: string; tenantId?: string; role: Role }) {
  const requestContext = makeRequestContext(input);
  const prisma = makePrisma();
  const tenantScope = makeTenantScope(requestContext);
  return { service: new UserService(prisma as any, requestContext as any, tenantScope as any), prisma };
}

async function expectRejectsAs(fn: () => Promise<unknown>, ErrorClass: new (...args: any[]) => Error) {
  await assert.rejects(fn, (error: unknown) => error instanceof ErrorClass);
}

async function run() {
  {
    const { service, prisma } = makeService({ userId: 'farmer-a', tenantId: 'tenant-a', role: 'FARMER' });
    await service.update('farmer-a', { name: 'New Name' } as any);
    const update = prisma.calls.find((call) => call.model === 'user' && call.action === 'update');
    assert.deepEqual(update.data, { name: 'New Name' });
  }

  for (const role of ['TENANT_ADMIN', 'COOPERATIVE_ADMIN'] as const) {
    const { service, prisma } = makeService({ userId: 'farmer-a', tenantId: 'tenant-a', role: 'FARMER' });
    await service.update('farmer-a', { role } as any);
    const update = prisma.calls.find((call) => call.model === 'user' && call.action === 'update');
    assert.deepEqual(update.data, {});
  }

  {
    const { service, prisma } = makeService({ userId: 'farmer-a', tenantId: 'tenant-a', role: 'FARMER' });
    await service.update('farmer-a', { farmId: 'farm-b', tenantId: 'tenant-b' } as any);
    const update = prisma.calls.find((call) => call.model === 'user' && call.action === 'update');
    assert.deepEqual(update.data, {});
  }

  {
    const { service } = makeService({ userId: 'admin-a', tenantId: 'tenant-a', role: 'TENANT_ADMIN' });
    await expectRejectsAs(() => service.update('user-b', { name: 'Cross Tenant' } as any), NotFoundException);
  }

  {
    const { service } = makeService({ userId: 'admin-a', tenantId: 'tenant-a', role: 'TENANT_ADMIN' });
    await expectRejectsAs(() => service.update('user-a', { role: 'PLATFORM_ADMIN' } as any), ForbiddenException);
    await expectRejectsAs(() => service.create({ phone: '10001', name: 'Bad Admin', role: 'PLATFORM_ADMIN' } as any), ForbiddenException);
  }

  {
    const { service } = makeService({ userId: 'admin-a', tenantId: 'tenant-a', role: 'TENANT_ADMIN' });
    await expectRejectsAs(() => service.update('user-a', { farmId: 'farm-b' } as any), NotFoundException);
  }

  {
    const { service, prisma } = makeService({ userId: 'platform', role: 'PLATFORM_ADMIN' });
    await service.update('user-b', { tenantId: 'tenant-b', farmId: 'farm-b', role: 'TENANT_ADMIN', name: 'Managed' } as any);
    const update = prisma.calls.find((call) => call.model === 'user' && call.action === 'update');
    assert.deepEqual(update.data, { name: 'Managed', role: 'TENANT_ADMIN', tenantId: 'tenant-b', farmId: 'farm-b' });
  }

  for (const call of makePrisma().calls) {
    assert.equal('passwordHash' in (call.data ?? {}), false);
    assert.equal('tokenVersion' in (call.data ?? {}), false);
  }

  console.log('User privilege hardening checks passed.');
}

void run();
