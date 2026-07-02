import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';
import { CreateAnomalyRuleDto } from './dto/create-anomaly-rule.dto';

@Injectable()
export class IrrigationMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService,
    private readonly farmActivityService: FarmActivityService
  ) {}

  createRule(dto: CreateAnomalyRuleDto) {
    return (this.prisma as any).irrigationAnomalyRule.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId: dto.farmId,
        name: dto.name,
        type: dto.type,
        thresholdJson: dto.thresholdJson,
        isActive: dto.isActive ?? true
      }
    });
  }

  listRules(query: Record<string, unknown>) {
    return (this.prisma as any).irrigationAnomalyRule.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.type === 'string' ? { type: query.type } : {}),
        ...(query.isActive !== undefined ? { isActive: String(query.isActive) !== 'false' } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  listAnomalies(query: Record<string, unknown>) {
    return (this.prisma as any).irrigationAnomalyEvent.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.fieldId === 'string' ? { fieldId: query.fieldId } : {}),
        ...(typeof query.type === 'string' ? { type: query.type } : {}),
        ...(query.handled !== undefined ? { handled: String(query.handled) === 'true' } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async handleAnomaly(id: string) {
    const anomaly = await (this.prisma as any).irrigationAnomalyEvent.findUnique({ where: { id } });
    if (!anomaly) throw new NotFoundException('Irrigation anomaly not found');
    return (this.prisma as any).irrigationAnomalyEvent.update({ where: { id }, data: { handled: true } });
  }

  async evaluate(snapshot: any) {
    const rules = await (this.prisma as any).irrigationAnomalyRule.findMany({
      where: { isActive: true, OR: [{ farmId: snapshot.farmId }, { farmId: null }] }
    });
    const events = [];
    for (const rule of rules) {
      const result = this.checkRule(rule, snapshot);
      if (!result) continue;
      const event = await this.createAnomaly({
        tenantId: snapshot.tenantId,
        farmId: snapshot.farmId,
        fieldId: snapshot.fieldId,
        deviceId: snapshot.deviceId,
        type: rule.type,
        severity: result.severity,
        message: result.message,
        snapshotJson: snapshot
      });
      events.push(event);
    }
    return events;
  }

  private async createAnomaly(input: {
    tenantId?: string | null;
    farmId?: string | null;
    fieldId?: string | null;
    deviceId?: string | null;
    type: string;
    severity: string;
    message: string;
    snapshotJson?: unknown;
  }) {
    const anomaly = await (this.prisma as any).irrigationAnomalyEvent.create({ data: input });
    if (input.farmId) {
      await (this.prisma as any).safetyAlert.create({
        data: {
          tenantId: input.tenantId,
          farmId: input.farmId,
          fieldId: input.fieldId,
          severity: input.severity,
          alertType: input.type,
          message: input.message,
          metadata: { source: 'IRRIGATION_MONITORING', anomalyId: anomaly.id }
        }
      });
      await this.farmActivityService.create({
        tenantId: input.tenantId,
        farmId: input.farmId,
        fieldId: input.fieldId,
        type: 'SENSOR_ALERT',
        title: input.message,
        refType: 'IrrigationAnomalyEvent',
        refId: anomaly.id,
        metadata: { type: input.type, severity: input.severity }
      });
    }
    this.eventBus.publish('irrigation.anomaly.detected', { farmId: input.farmId, fieldId: input.fieldId, anomalyId: anomaly.id, type: input.type }, input.tenantId ?? undefined);
    return anomaly;
  }

  private checkRule(rule: any, snapshot: any) {
    const threshold = rule.thresholdJson ?? {};
    const min = Number(threshold.min ?? threshold.minPressureKpa ?? threshold.minFlowRateM3h ?? threshold.pressureKpaMin ?? threshold.minLevelPercent);
    const max = Number(threshold.max ?? threshold.maxPressureKpa ?? threshold.maxFlowRateM3h);
    const severity = String(threshold.severity ?? 'MEDIUM');
    if (rule.type === 'PRESSURE_DROP' && Number.isFinite(min) && Number(snapshot.pressureKpa) < min) {
      return { severity, message: `水压低于阈值：${snapshot.pressureKpa} kPa < ${min} kPa` };
    }
    if (rule.type === 'PRESSURE_TOO_HIGH' && Number.isFinite(max) && Number(snapshot.pressureKpa) > max) {
      return { severity, message: `水压高于阈值：${snapshot.pressureKpa} kPa > ${max} kPa` };
    }
    if (rule.type === 'FLOW_TOO_LOW' && Number.isFinite(min) && Number(snapshot.flowRateM3h) < min) {
      return { severity, message: `流量低于阈值：${snapshot.flowRateM3h} m3/h < ${min} m3/h` };
    }
    if (rule.type === 'FLOW_TOO_HIGH' && Number.isFinite(max) && Number(snapshot.flowRateM3h) > max) {
      return { severity, message: `流量高于阈值：${snapshot.flowRateM3h} m3/h > ${max} m3/h` };
    }
    if (rule.type === 'TANK_LOW_LEVEL' && Number.isFinite(min) && Number(snapshot.fertilizerTankLevelL ?? snapshot.waterTankLevelL) < min) {
      return { severity, message: `液位低于阈值：${snapshot.fertilizerTankLevelL ?? snapshot.waterTankLevelL} L < ${min} L` };
    }
    if (rule.type === 'VALVE_NOT_RESPONDING') {
      const openingMin = Number(threshold.openingPercentMin ?? 10);
      const flowMax = Number(threshold.flowRateM3hMax ?? 0.05);
      if (Number(snapshot.valveOpeningPercent) >= openingMin && Number(snapshot.flowRateM3h) <= flowMax) {
        return { severity, message: `阀门疑似无响应：开度 ${snapshot.valveOpeningPercent}% 但流量 ${snapshot.flowRateM3h} m3/h` };
      }
    }
    if (rule.type === 'PUMP_ABNORMAL') {
      const frequencyMin = Number(threshold.pumpFrequencyHzMin ?? 10);
      const pressureMin = Number(threshold.pressureKpaMin ?? 50);
      if (Number(snapshot.pumpFrequencyHz) >= frequencyMin && Number(snapshot.pressureKpa) < pressureMin) {
        return { severity, message: `水泵疑似异常：频率 ${snapshot.pumpFrequencyHz} Hz 但压力 ${snapshot.pressureKpa} kPa` };
      }
    }
    if (rule.type === 'PUMP_ABNORMAL' && threshold.status && snapshot.pumpRunningStatus && snapshot.pumpRunningStatus !== threshold.status) {
      return { severity, message: `水泵状态异常：${snapshot.pumpRunningStatus}` };
    }
    return null;
  }
}
