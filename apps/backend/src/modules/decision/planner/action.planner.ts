import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OptimizedStrategy } from '../optimizer/optimizer.service';
import { DecisionFieldState } from '../state/state.service';

export type DecisionActionPlan = {
  status: 'PLANNED' | 'SKIPPED';
  actions: Array<{
    type: 'DEVICE_COMMAND' | 'MANUAL_CHECK';
    command?: 'PUMP_ON' | 'PUMP_OFF' | 'CHECK_DEVICE';
    deviceId?: string;
    deviceCode?: string;
    reason: string;
  }>;
  safetyWarnings: string[];
};

@Injectable()
export class ActionPlanner {
  constructor(private readonly prisma: PrismaService) {}

  async plan(fieldState: DecisionFieldState, strategy: OptimizedStrategy): Promise<DecisionActionPlan> {
    const actions: DecisionActionPlan['actions'] = [];
    const pump = await this.prisma.device.findFirst({
      where: { fieldId: fieldState.fieldId, type: 'PUMP' },
      orderBy: { createdAt: 'desc' }
    });

    if (strategy.recommendation === 'SHOULD_IRRIGATE' && pump) {
      actions.push({ type: 'DEVICE_COMMAND', command: 'PUMP_ON', deviceId: pump.id, deviceCode: pump.code, reason: strategy.reason });
    }

    if (strategy.recommendation === 'STOP_IRRIGATION' && pump) {
      actions.push({ type: 'DEVICE_COMMAND', command: 'PUMP_OFF', deviceId: pump.id, deviceCode: pump.code, reason: strategy.reason });
    }

    if (strategy.recommendation === 'CHECK_DEVICE') {
      actions.push({ type: 'MANUAL_CHECK', command: 'CHECK_DEVICE', reason: strategy.reason });
    }

    const safetyWarnings = [...strategy.safetyWarnings];
    if ((strategy.recommendation === 'SHOULD_IRRIGATE' || strategy.recommendation === 'STOP_IRRIGATION') && !pump) {
      safetyWarnings.push('No pump device found for this field.');
    }

    return {
      status: actions.length > 0 && safetyWarnings.length === 0 ? 'PLANNED' : 'SKIPPED',
      actions,
      safetyWarnings
    };
  }
}
