import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    options: { cursor?: string; limit: number; unreadOnly: boolean },
  ) {
    if (options.cursor) {
      const cursor = await this.prisma.notification.findFirst({
        where: { id: options.cursor, userId },
        select: { id: true },
      });
      if (!cursor) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'El cursor no es válido.',
        });
      }
    }
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasNext = items.length > options.limit;
    const page = hasNext ? items.slice(0, options.limit) : items;
    return {
      items: page.map((item) => this.toContract(item)),
      nextCursor: hasNext ? page.at(-1)?.id ?? null : null,
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'La notificación no existe.',
      });
    }
    const updated = notification.readAt
      ? notification
      : await this.prisma.notification.update({
          where: { id },
          data: { readAt: new Date() },
        });
    return this.toContract(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  private toContract(notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    resourceType: string | null;
    resourceId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      read: notification.readAt !== null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
