import { PrismaClient } from '@prisma/client';

// Seeds the OpenAgriOS v0.1-alpha demo farm: Jingshan Farm / Onion Field 01 / sensor-001.
//
// Deliberately separate from seed-demo-farm.ts (farm id "demo", "洋葱智慧农场 Demo"), which is
// the existing production demo baseline wired into apps/mobile's default farm id and several
// scripts. This is a second, independent, idempotent seed for the public alpha's own demo path
// and does not touch the existing one.
const prisma = new PrismaClient();

export const OPEN_AGRIOS_DEMO_FARM_ID = 'openagrios-demo-farm';
export const OPEN_AGRIOS_DEMO_FIELD_ID = 'openagrios-demo-field-01';
export const OPEN_AGRIOS_DEMO_DEVICE_CODE = 'sensor-001';

export async function seedOpenAgriosDemo(client: PrismaClient = prisma) {
  const farm = await client.farm.upsert({
    where: { id: OPEN_AGRIOS_DEMO_FARM_ID },
    update: { name: 'Jingshan Farm', type: 'FAMILY' },
    create: {
      id: OPEN_AGRIOS_DEMO_FARM_ID,
      name: 'Jingshan Farm',
      type: 'FAMILY',
      address: 'Jingshan, Hubei, China',
      remark: 'OpenAgriOS v0.1-alpha demo farm — 300 mu onion farm validation scenario.'
    }
  });

  const field = await client.field.upsert({
    where: { id: OPEN_AGRIOS_DEMO_FIELD_ID },
    update: { name: 'Onion Field 01', farmId: farm.id },
    create: {
      id: OPEN_AGRIOS_DEMO_FIELD_ID,
      farmId: farm.id,
      name: 'Onion Field 01',
      areaMu: 300,
      soilType: 'Loam',
      irrigationMethod: 'Drip irrigation'
    }
  });

  const device = await client.device.upsert({
    where: { code: OPEN_AGRIOS_DEMO_DEVICE_CODE },
    update: { name: 'Sensor 001 — Soil & Climate', fieldId: field.id },
    create: {
      code: OPEN_AGRIOS_DEMO_DEVICE_CODE,
      name: 'Sensor 001 — Soil & Climate',
      type: 'SOIL_SENSOR',
      fieldId: field.id,
      online: false
    }
  });

  return { farm, field, device };
}

if (require.main === module) {
  seedOpenAgriosDemo()
    .then((result) => {
      console.log('OpenAgriOS demo seed complete:', result.farm.name, '/', result.field.name, '/', result.device.code);
    })
    .catch((error) => {
      console.error('OpenAgriOS demo seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
