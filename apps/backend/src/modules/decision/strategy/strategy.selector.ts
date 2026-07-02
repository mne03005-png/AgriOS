import { Injectable } from '@nestjs/common';
import { DecisionFieldState } from '../state/state.service';

export type DecisionStrategy = {
  name: string;
  recommendation: 'NO_ACTION' | 'SHOULD_IRRIGATE' | 'STOP_IRRIGATION' | 'CHECK_DEVICE';
  confidence: number;
  reason: string;
};

@Injectable()
export class StrategySelector {
  select(fieldState: DecisionFieldState): DecisionStrategy {
    if (fieldState.soilMoisture === null) {
      return {
        name: 'device-health-fallback',
        recommendation: fieldState.deviceOfflineCount > 0 ? 'CHECK_DEVICE' : 'NO_ACTION',
        confidence: 0.55,
        reason: 'No soil moisture telemetry is available.'
      };
    }

    if (fieldState.soilMoisture < 35) {
      return {
        name: 'soil-moisture-irrigation',
        recommendation: 'SHOULD_IRRIGATE',
        confidence: fieldState.soilMoisture < 25 ? 0.92 : 0.82,
        reason: `Soil moisture is ${fieldState.soilMoisture}%, below threshold.`
      };
    }

    if (fieldState.soilMoisture > 60) {
      return {
        name: 'soil-moisture-stop-irrigation',
        recommendation: 'STOP_IRRIGATION',
        confidence: fieldState.soilMoisture > 75 ? 0.92 : 0.82,
        reason: `Soil moisture is ${fieldState.soilMoisture}%, above safe range.`
      };
    }

    return {
      name: 'normal-observation',
      recommendation: 'NO_ACTION',
      confidence: 0.75,
      reason: `Soil moisture is ${fieldState.soilMoisture}%, within normal range.`
    };
  }
}
