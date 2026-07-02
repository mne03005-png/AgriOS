import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RunWettingSimulationDto } from './dto/run-wetting-simulation.dto';

@Injectable()
export class WettingSimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async run(dto: RunWettingSimulationDto) {
    const result = this.calculate(dto);
    const saved = await (this.prisma as any).wettingSimulation.create({
      data: {
        fieldId: dto.fieldId,
        designId: dto.designId,
        cropType: dto.cropType,
        soilType: dto.soilType,
        emitterFlowRate: dto.emitterFlowRate,
        irrigationMinutes: dto.irrigationMinutes,
        surfaceWettingRange: result.surfaceWettingRange,
        rootZoneWettingRange: result.rootZoneWettingRange,
        deepPercolationRisk: result.deepPercolationRisk,
        resultJson: result
      }
    });
    return { simulation: saved, ...result };
  }

  preview(dto: RunWettingSimulationDto) {
    return this.calculate(dto);
  }

  private calculate(dto: RunWettingSimulationDto) {
    const waterVolume = (dto.emitterFlowRate * dto.irrigationMinutes) / 60;
    const soil = dto.soilType.toLowerCase();
    const profile =
      soil.includes('sand') || soil.includes('砂')
        ? { surface: 0.65, root: 1.45, riskAt: 0.85 }
        : soil.includes('clay') || soil.includes('黏') || soil.includes('粘')
          ? { surface: 1.35, root: 0.75, riskAt: 1.4 }
          : { surface: 1, root: 1, riskAt: 1.1 };
    const surfaceWettingRange = Number((Math.sqrt(waterVolume) * profile.surface * 0.42).toFixed(3));
    const rootZoneWettingRange = Number((Math.sqrt(waterVolume) * profile.root * 0.55).toFixed(3));
    const deepPercolationRisk = waterVolume > profile.riskAt * 1.8 ? 'HIGH' : waterVolume > profile.riskAt ? 'MEDIUM' : 'LOW';
    const recommendation =
      deepPercolationRisk === 'HIGH'
        ? '深层渗漏风险高，建议缩短灌溉时长或分次灌溉'
        : deepPercolationRisk === 'MEDIUM'
          ? '存在一定深渗风险，建议观察土壤湿度变化'
          : '湿润范围较安全，可按计划执行';
    return {
      surfaceWettingRange,
      rootZoneWettingRange,
      deepPercolationRisk,
      recommendation,
      expectedMoistureIncrease: Number(Math.min(18, waterVolume * 3.2).toFixed(2)),
      recommendedDuration: deepPercolationRisk === 'HIGH' ? Math.max(5, Math.floor(dto.irrigationMinutes * 0.6)) : dto.irrigationMinutes
    };
  }
}
