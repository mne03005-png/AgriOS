import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StrategyEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(snapshot: any) {
    const soilMoisture = snapshot.soilMoisture === null || snapshot.soilMoisture === undefined ? undefined : Number(snapshot.soilMoisture);
    if (soilMoisture === undefined) {
      return {
        decisionType: 'DEVICE_HEALTH',
        recommendation: snapshot.deviceOfflineCount > 0 ? 'CHECK_DEVICE' : 'NO_ACTION',
        confidence: 0.55,
        reason: 'No soil moisture telemetry is available; device health check is recommended.'
      };
    }

    const recipeContext = await this.findRecipeContext(snapshot);
    const min = Number(recipeContext.recipe?.targetMoistureMin ?? 35);
    const max = Number(recipeContext.recipe?.targetMoistureMax ?? 60);
    const source = recipeContext.recipe ? 'CROP_RECIPE' : 'FALLBACK_RULE';

    if (soilMoisture < min) {
      return {
        decisionType: 'IRRIGATION',
        recommendation: 'SHOULD_IRRIGATE',
        confidence: soilMoisture < min - 10 ? 0.92 : 0.82,
        reason: `Soil moisture is ${soilMoisture}%, below the ${source} irrigation threshold ${min}%.`,
        recipe: recipeContext.recipe,
        strategySource: source
      };
    }
    if (soilMoisture > max) {
      return {
        decisionType: 'IRRIGATION',
        recommendation: 'STOP_IRRIGATION',
        confidence: soilMoisture > max + 15 ? 0.92 : 0.82,
        reason: `Soil moisture is ${soilMoisture}%, above the ${source} stop-irrigation threshold ${max}%.`,
        recipe: recipeContext.recipe,
        strategySource: source
      };
    }
    return {
      decisionType: 'IRRIGATION',
      recommendation: 'NO_ACTION',
      confidence: 0.75,
      reason: `Soil moisture is ${soilMoisture}%, within the ${source} normal range ${min}-${max}%.`,
      recipe: recipeContext.recipe,
      strategySource: source
    };
  }

  private async findRecipeContext(snapshot: any) {
    const summary = snapshot.summary ?? {};
    const field = await this.prisma.field.findUnique({ where: { id: snapshot.fieldId } });
    const cropSeason = snapshot.cropSeasonId ? await this.prisma.cropSeason.findUnique({ where: { id: snapshot.cropSeasonId } }) : null;
    const cropType = cropSeason?.cropName ?? summary.cropName;
    const cropStage = cropSeason?.status ? String(cropSeason.status).toLowerCase() : 'growing';
    const soilType = field?.soilType ?? undefined;
    if (!cropType) return { recipe: null };
    const recipe = await (this.prisma as any).cropIrrigationRecipe.findFirst({
      where: {
        cropType,
        cropStage,
        isActive: true,
        OR: [{ soilType }, { soilType: null }]
      },
      orderBy: [{ soilType: 'desc' }, { createdAt: 'desc' }]
    });
    return { recipe };
  }
}
