import { Injectable } from '@nestjs/common';

export type IrrigationRuleAction = 'SHOULD_IRRIGATE' | 'NORMAL' | 'STOP_IRRIGATION';

@Injectable()
export class IrrigationRuleService {
  evaluate(input: { fieldId: string; soilMoisture: number }) {
    if (input.soilMoisture < 35) {
      return {
        action: 'SHOULD_IRRIGATE' as IrrigationRuleAction,
        message: '土壤湿度偏低，建议灌溉',
        fieldId: input.fieldId,
        soilMoisture: input.soilMoisture
      };
    }

    if (input.soilMoisture > 60) {
      return {
        action: 'STOP_IRRIGATION' as IrrigationRuleAction,
        message: '土壤湿度偏高，建议停止灌溉',
        fieldId: input.fieldId,
        soilMoisture: input.soilMoisture
      };
    }

    return {
      action: 'NORMAL' as IrrigationRuleAction,
      message: '土壤湿度正常',
      fieldId: input.fieldId,
      soilMoisture: input.soilMoisture
    };
  }
}
