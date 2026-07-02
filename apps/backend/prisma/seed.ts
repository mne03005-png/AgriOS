import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedDefaultTemplates } from './seed-default-templates';
import { seedDemoFarm } from './seed-demo-farm';

const prisma = new PrismaClient();

async function main() {
  const templateResult = await seedDefaultTemplates(prisma);
  console.log('Default templates seeded:', templateResult);
  const demoResult = await seedDemoFarm(prisma);
  console.log('Demo farm seeded:', demoResult);

  const passwordHash = await bcrypt.hash('123456', 10);
  const farm = await prisma.farm.upsert({
    where: { id: 'seed-family-onion-farm' },
    update: {},
    create: {
      id: 'seed-family-onion-farm',
      name: '家庭洋葱种植农场',
      type: 'FAMILY'
    }
  });

  await prisma.user.upsert({
    where: { phone: '13800000000' },
    update: {
      name: '测试农户',
      role: 'FARMER',
      farmId: farm.id,
      passwordHash
    },
    create: {
      name: '测试农户',
      phone: '13800000000',
      role: 'FARMER',
      farmId: farm.id,
      passwordHash
    }
  });

  const field = await prisma.field.upsert({
    where: { id: 'seed-onion-field-a' },
    update: {},
    create: {
      id: 'seed-onion-field-a',
      farmId: farm.id,
      name: '洋葱地A',
      areaMu: 300,
      landSource: 'SELF',
      lastYearCrop: '洋葱',
      currentSuggestion: '不建议连续种植洋葱，建议轮作'
    }
  });

  await prisma.cropSeason.upsert({
    where: {
      fieldId_cropName_year_season: {
        fieldId: field.id,
        cropName: '洋葱',
        year: 2026,
        season: 'spring'
      }
    },
    update: {
      status: 'GROWING'
    },
    create: {
      fieldId: field.id,
      cropName: '洋葱',
      year: 2026,
      season: 'spring',
      status: 'GROWING'
    }
  });

  await prisma.device.upsert({
    where: { code: 'soil-001' },
    update: {
      fieldId: field.id,
      name: '洋葱地A土壤湿度传感器1',
      type: 'SOIL_SENSOR',
      mqttTopic: 'agrios/device/soil-001/telemetry'
    },
    create: {
      fieldId: field.id,
      code: 'soil-001',
      name: '洋葱地A土壤湿度传感器1',
      type: 'SOIL_SENSOR',
      mqttTopic: 'agrios/device/soil-001/telemetry'
    }
  });

  await prisma.device.upsert({
    where: { code: 'pump-001' },
    update: {
      fieldId: field.id,
      name: '洋葱地A水泵控制器',
      type: 'PUMP',
      mqttTopic: 'agrios/device/pump-001/status'
    },
    create: {
      fieldId: field.id,
      code: 'pump-001',
      name: '洋葱地A水泵控制器',
      type: 'PUMP',
      mqttTopic: 'agrios/device/pump-001/status'
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
