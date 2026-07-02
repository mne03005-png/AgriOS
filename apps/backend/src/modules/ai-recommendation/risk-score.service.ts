import { Injectable } from '@nestjs/common';

@Injectable()
export class RiskScoreService {
  scoreSeverity(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  moistureRisk(value?: number | null, min = 35) {
    if (value === null || value === undefined || !Number.isFinite(value)) return 0;
    return value < min ? Math.min(100, (min - value) * 4) : 0;
  }
}
