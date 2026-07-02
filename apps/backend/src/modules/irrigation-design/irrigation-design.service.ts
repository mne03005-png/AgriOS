import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIrrigationDesignDto } from './dto/create-irrigation-design.dto';
import { GenerateBomDto } from './dto/generate-bom.dto';
import { RunHydraulicCheckDto } from './dto/run-hydraulic-check.dto';
import { UpdateIrrigationDesignDto } from './dto/update-irrigation-design.dto';

@Injectable()
export class IrrigationDesignService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateIrrigationDesignDto) {
    const { zones, ...design } = dto;
    return (this.prisma as any).irrigationDesign.create({
      data: {
        ...design,
        zones: zones?.length ? { create: zones } : undefined
      },
      include: { zones: true }
    });
  }

  findAll(query: Record<string, unknown> = {}) {
    return (this.prisma as any).irrigationDesign.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.status === 'string' ? { status: query.status } : {})
      },
      include: { zones: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findOne(id: string) {
    const design = await (this.prisma as any).irrigationDesign.findUnique({
      where: { id },
      include: { zones: true, boms: { include: { items: true } }, hydraulicResults: true }
    });
    if (!design) throw new NotFoundException('Irrigation design not found');
    return design;
  }

  async update(id: string, dto: UpdateIrrigationDesignDto) {
    await this.findOne(id);
    const { zones: _zones, ...data } = dto;
    return (this.prisma as any).irrigationDesign.update({ where: { id }, data, include: { zones: true } });
  }

  async generateBOM(designId: string, dto: GenerateBomDto = {}) {
    const design = await this.findOne(designId);
    const areaMu = Number(design.area);
    const areaSquareMeters = areaMu * 666.6666667;
    const driplineLength = areaSquareMeters / Number(design.lateralSpacing);
    const emitterCount = Math.ceil(driplineLength / Number(design.emitterSpacing));
    const zoneCount = Math.max(design.zones.length, 1);
    const planned = [
      { category: 'DRIPLINE', name: '滴灌带', spec: `${design.emitterSpacing}m/${design.emitterFlowRate}Lh`, quantity: driplineLength, unit: 'm' },
      { category: 'CONNECTOR', name: '滴灌带接头', spec: 'standard', quantity: Math.ceil(driplineLength / 100), unit: '个' },
      { category: 'VALVE', name: '电磁阀', spec: 'zone valve', quantity: zoneCount, unit: '个' },
      { category: 'FILTER', name: '过滤器', spec: 'main filter', quantity: 1, unit: '套' },
      { category: 'CONTROLLER', name: '灌溉控制器', spec: 'multi-zone', quantity: 1, unit: '台' },
      { category: 'SENSOR', name: '土壤湿度传感器', spec: 'soil moisture', quantity: zoneCount, unit: '个' }
    ];

    const products = dto.useProductCatalog === false ? [] : await (this.prisma as any).irrigationProduct.findMany({ where: { isActive: true } });
    const items = planned.map((item) => {
      const product = products.find((candidate: any) => candidate.category === item.category);
      const unitPrice = product?.unitPrice === null || product?.unitPrice === undefined ? undefined : Number(product.unitPrice);
      const amount = unitPrice === undefined ? undefined : Number((unitPrice * item.quantity).toFixed(2));
      return { ...item, productId: product?.id, spec: product?.spec ?? item.spec, unitPrice, amount };
    });
    const totalCost = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const bom = await (this.prisma as any).irrigationBOM.create({
      data: {
        designId,
        status: 'GENERATED',
        totalCost: totalCost > 0 ? totalCost : undefined,
        items: { create: items }
      },
      include: { items: true }
    });
    return { bom, items: bom.items, estimatedCost: totalCost, engineering: { driplineLength, emitterCount, zoneCount } };
  }

  async runHydraulicCheck(designId: string, dto: RunHydraulicCheckDto = {}) {
    const design = await this.findOne(designId);
    const areaSquareMeters = Number(design.area) * 666.6666667;
    const driplineLength = areaSquareMeters / Number(design.lateralSpacing);
    const emitterCount = Math.ceil(driplineLength / Number(design.emitterSpacing));
    const requiredFlow = emitterCount * Number(design.emitterFlowRate);
    const lossFactor = dto.simpleLossFactor ?? 0.002;
    const zones = design.zones.length ? design.zones : [{ id: null, pipeLength: 100, pipeDiameter: 50, expectedFlowRate: requiredFlow }];
    const results = [];
    for (const zone of zones) {
      const pipeLength = Number(zone.pipeLength ?? 100);
      const pipeDiameter = Number(zone.pipeDiameter ?? 50);
      const diameterFactor = pipeDiameter < 50 ? 1.6 : pipeDiameter < 63 ? 1.2 : 1;
      const pressureLoss = Number((pipeLength * lossFactor * diameterFactor).toFixed(3));
      const endPressure = Number((Number(design.sourceWaterPressure) - pressureLoss).toFixed(3));
      const flowVariation = Number((Math.max(0, (Number(design.targetPressure) - endPressure) / Number(design.targetPressure)) * 100).toFixed(2));
      const warnings = this.hydraulicWarnings({ endPressure, targetPressure: Number(design.targetPressure), flowVariation, pipeDiameter, requiredFlow, targetFlowRate: Number(design.targetFlowRate ?? requiredFlow) });
      const isPassed = endPressure >= Number(design.targetPressure) && flowVariation <= 20 && !warnings.includes('PIPE_DIAMETER_TOO_SMALL');
      results.push(
        await (this.prisma as any).hydraulicCheckResult.create({
          data: {
            designId,
            zoneId: zone.id,
            inputJson: { emitterCount, requiredFlow, pipeLength, pipeDiameter, lossFactor },
            resultJson: { requiredFlow, endPressure, flowVariation, warnings },
            pressureLoss,
            endPressure,
            flowVariation,
            isPassed,
            warnings
          }
        })
      );
    }
    const overallPassed = results.every((item: any) => item.isPassed);
    await (this.prisma as any).irrigationDesign.update({ where: { id: designId }, data: { status: overallPassed ? 'CHECKED' : 'DRAFT' } });
    return { isPassed: overallPassed, requiredFlow, emitterCount, results };
  }

  private hydraulicWarnings(input: { endPressure: number; targetPressure: number; flowVariation: number; pipeDiameter: number; requiredFlow: number; targetFlowRate: number }) {
    const warnings: string[] = [];
    if (input.endPressure < input.targetPressure) warnings.push('LOW_END_PRESSURE');
    if (input.flowVariation > 20) warnings.push('HIGH_FLOW_VARIATION');
    if (input.pipeDiameter < 32) warnings.push('PIPE_DIAMETER_TOO_SMALL');
    if (input.requiredFlow > input.targetFlowRate * 1.15) warnings.push('PUMP_CAPACITY_REQUIRED');
    return warnings;
  }
}
