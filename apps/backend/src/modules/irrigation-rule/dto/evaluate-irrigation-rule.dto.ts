import { Allow } from 'class-validator';

export class EvaluateIrrigationRuleDto {
  @Allow()
  fieldId!: string;

  @Allow()
  soilMoisture!: number;
}
