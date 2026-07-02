import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

@Injectable()
export class OperationReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService
  ) {}

  list(query: Record<string, unknown>) {
    return (this.prisma as any).operationReport.findMany({
      where: {
        ...(typeof query.farmId === 'string' ? { farmId: query.farmId } : {}),
        ...(typeof query.type === 'string' ? { type: query.type } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async findOne(id: string) {
    const report = await (this.prisma as any).operationReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Operation report not found');
    return report;
  }

  async generate(input: { farmId: string; type: string; refId?: string; title?: string }) {
    const summary = await this.buildSummary(input);
    return (this.prisma as any).operationReport.create({
      data: {
        tenantId: this.requestContext.getTenantId(),
        farmId: input.farmId,
        type: input.type,
        refId: input.refId,
        title: input.title ?? this.defaultTitle(input.type),
        summaryJson: summary.summaryJson,
        metricsJson: summary.metricsJson
      }
    });
  }

  private async buildSummary(input: { farmId: string; type: string; refId?: string }) {
    if (input.type === 'ROTATION') {
      const runs = await (this.prisma as any).irrigationRotationRun.findMany({ where: { farmId: input.farmId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return { summaryJson: { recentRuns: runs }, metricsJson: { total: runs.length, success: runs.filter((item: any) => item.status === 'SUCCESS').length } };
    }
    if (input.type === 'FERTIGATION') {
      const tasks = await (this.prisma as any).fertigationTask.findMany({ where: { farmId: input.farmId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return { summaryJson: { recentTasks: tasks }, metricsJson: { total: tasks.length, success: tasks.filter((item: any) => item.status === 'SUCCESS').length } };
    }
    if (input.type === 'ANOMALY') {
      const anomalies = await (this.prisma as any).irrigationAnomalyEvent.findMany({ where: { farmId: input.farmId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return { summaryJson: { recentAnomalies: anomalies }, metricsJson: { total: anomalies.length, unhandled: anomalies.filter((item: any) => !item.handled).length } };
    }
    const irrigationRecords = await this.prisma.irrigationRecord.findMany({ where: { field: { farmId: input.farmId } }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { summaryJson: { recentIrrigationRecords: irrigationRecords }, metricsJson: { total: irrigationRecords.length } };
  }

  private defaultTitle(type: string) {
    const titles: Record<string, string> = {
      IRRIGATION: '灌溉作业报告',
      FERTIGATION: '水肥作业报告',
      ROTATION: '轮灌执行报告',
      DEVICE_INSPECTION: '设备巡检报告',
      ANOMALY: '异常处置报告',
      DRONE_MAPPING: '无人机测绘报告',
      DRONE_SPRAYING: '无人机喷洒报告',
      DRONE_SPREADING: '无人机撒播报告',
      DRONE_SCOUTING: '无人机巡田报告'
    };
    return titles[type] ?? '作业报告';
  }
}
