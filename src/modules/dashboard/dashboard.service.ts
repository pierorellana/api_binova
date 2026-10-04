import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { segment: true },
    });
    const segment = user?.segment ?? 'standard';
    const config = await this.prisma.dashboardConfig.findFirst({
      where: { segment, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const raw = config?.config;
    const sections =
      raw && typeof raw === 'object' && !Array.isArray(raw) && 'sections' in raw
        ? (raw as { sections?: unknown }).sections
        : [];
    return {
      schemaVersion: config?.schemaVersion ?? 1,
      segment,
      sections: Array.isArray(sections) ? sections : [],
    };
  }
}
