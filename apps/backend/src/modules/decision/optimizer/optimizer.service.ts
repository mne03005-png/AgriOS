import { Injectable } from '@nestjs/common';
import { DecisionStrategy } from '../strategy/strategy.selector';
import { DecisionFieldState } from '../state/state.service';

export type OptimizedStrategy = DecisionStrategy & {
  executable: boolean;
  safetyWarnings: string[];
};

@Injectable()
export class OptimizerService {
  optimize(fieldState: DecisionFieldState, strategy: DecisionStrategy): OptimizedStrategy {
    const safetyWarnings: string[] = [];
    if (fieldState.deviceTotal === 0 && strategy.recommendation !== 'NO_ACTION') {
      safetyWarnings.push('No device is bound to this field.');
    }
    if (fieldState.deviceTotal > 0 && fieldState.deviceOnlineCount === 0 && strategy.recommendation !== 'NO_ACTION') {
      safetyWarnings.push('All bound devices are offline.');
    }
    return {
      ...strategy,
      executable: safetyWarnings.length === 0 && strategy.recommendation !== 'NO_ACTION',
      safetyWarnings
    };
  }
}
