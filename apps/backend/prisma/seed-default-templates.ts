import { PrismaClient } from '@prisma/client';

type TemplateResult = {
  anomalyRules: number;
  safetyPolicies: number;
  irrigationProducts: number;
  cropRecipes: number;
  fertigationRecipes: number;
};

export async function seedDefaultTemplates(prisma: PrismaClient): Promise<TemplateResult> {
  const result: TemplateResult = {
    anomalyRules: 0,
    safetyPolicies: 0,
    irrigationProducts: 0,
    cropRecipes: 0,
    fertigationRecipes: 0
  };

  for (const rule of anomalyRules()) {
    const existing = await (prisma as any).irrigationAnomalyRule.findFirst({ where: { farmId: null, name: rule.name, type: rule.type } });
    if (!existing) {
      await (prisma as any).irrigationAnomalyRule.create({ data: rule });
      result.anomalyRules += 1;
    }
  }

  const safetyPolicy = {
    name: 'Default assisted execution safety policy',
    allowAutoExecution: false,
    maxIrrigationMinutesPerAction: 120,
    maxDailyIrrigationMinutesPerField: 360,
    emergencyStopEnabled: false,
    requireApprovalRiskLevel: 'MEDIUM',
    isActive: true
  };
  if (!(await (prisma as any).safetyPolicy.findFirst({ where: { farmId: null, fieldId: null, name: safetyPolicy.name } }))) {
    await (prisma as any).safetyPolicy.create({ data: safetyPolicy });
    result.safetyPolicies += 1;
  }

  for (const product of irrigationProducts()) {
    const existing = await (prisma as any).irrigationProduct.findFirst({ where: { category: product.category, name: product.name, spec: product.spec } });
    if (!existing) {
      await (prisma as any).irrigationProduct.create({ data: product });
      result.irrigationProducts += 1;
    }
  }

  for (const recipe of cropRecipes()) {
    const existing = await (prisma as any).cropIrrigationRecipe.findFirst({
      where: { cropType: recipe.cropType, cropStage: recipe.cropStage, soilType: recipe.soilType }
    });
    if (!existing) {
      await (prisma as any).cropIrrigationRecipe.create({ data: recipe });
      result.cropRecipes += 1;
    }
  }

  for (const recipe of fertigationRecipes()) {
    const existing = await (prisma as any).fertigationRecipe.findFirst({ where: { farmId: null, name: recipe.name } });
    if (!existing) {
      await (prisma as any).fertigationRecipe.create({ data: recipe });
      result.fertigationRecipes += 1;
    }
  }

  return result;
}

function anomalyRules() {
  return [
    { name: 'Default pressure drop', type: 'PRESSURE_DROP', thresholdJson: { minPressureKpa: 80, dropPercentWithinMinutes: 30, windowMinutes: 5 }, isActive: true },
    { name: 'Default pressure too high', type: 'PRESSURE_TOO_HIGH', thresholdJson: { maxPressureKpa: 500 }, isActive: true },
    { name: 'Default flow too low', type: 'FLOW_TOO_LOW', thresholdJson: { minFlowRateM3h: 0.3 }, isActive: true },
    { name: 'Default flow too high', type: 'FLOW_TOO_HIGH', thresholdJson: { maxFlowRateM3h: 20 }, isActive: true },
    { name: 'Default valve not responding', type: 'VALVE_NOT_RESPONDING', thresholdJson: { openingPercentMin: 10, flowRateM3hMax: 0.05 }, isActive: true },
    { name: 'Default pump abnormal', type: 'PUMP_ABNORMAL', thresholdJson: { pumpFrequencyHzMin: 10, pressureKpaMin: 50 }, isActive: true },
    { name: 'Default fertilizer tank low level', type: 'TANK_LOW_LEVEL', thresholdJson: { minLevelPercent: 15 }, isActive: true }
  ];
}

function irrigationProducts() {
  return [
    { category: 'DRIPLINE', name: 'Demo dripline', spec: 'demo baseline dripline', unit: 'm', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'VALVE', name: 'Demo valve', spec: 'demo electric valve', unit: 'set', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'FILTER', name: 'Demo filter', spec: 'demo disc filter', unit: 'set', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'PIPE', name: 'Demo pipe', spec: 'demo PE pipe', unit: 'm', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'CONNECTOR', name: 'Demo connector', spec: 'demo connector', unit: 'piece', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'SENSOR', name: 'Demo sensor', spec: 'demo pressure/flow sensor', unit: 'set', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'CONTROLLER', name: 'Demo controller', spec: 'demo irrigation controller', unit: 'set', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true },
    { category: 'FERTIGATION', name: 'Demo fertigation unit', spec: 'demo fertigation injector', unit: 'set', unitPrice: 0, metadataJson: { note: 'demo baseline' }, isActive: true }
  ];
}

function cropRecipes() {
  const crops = ['onion', 'soybean', 'corn', 'grape'];
  const soils = [
    { soilType: 'sandy', min: 28, max: 48, minutes: 25 },
    { soilType: 'loam', min: 35, max: 60, minutes: 35 },
    { soilType: 'clay', min: 40, max: 65, minutes: 45 }
  ];
  return crops.flatMap((cropType) =>
    soils.map((soil) => ({
      cropType,
      cropStage: 'demo_growth',
      soilType: soil.soilType,
      targetMoistureMin: soil.min,
      targetMoistureMax: soil.max,
      recommendedIrrigationMinutes: soil.minutes,
      maxDailyIrrigationMinutes: 180,
      fertigationAdvice: { note: 'demo baseline, should be calibrated by agronomist' },
      isActive: true
    }))
  );
}

function fertigationRecipes() {
  const recipeJson = {
    fertilizerType: 'demo NPK',
    dilutionRatio: '1:500',
    ecTarget: 'placeholder',
    phTarget: 'placeholder',
    notes: 'demo baseline, should be calibrated by agronomist'
  };
  return [
    { name: 'Generic seedling low concentration fertigation', cropStage: 'seedling', recipeJson, recommendedDurationMinutes: 20, isActive: true },
    { name: 'Generic vegetative growth fertigation', cropStage: 'vegetative', recipeJson, recommendedDurationMinutes: 35, isActive: true },
    { name: 'Generic bulking stage fertigation', cropStage: 'bulking', recipeJson, recommendedDurationMinutes: 45, isActive: true }
  ];
}
