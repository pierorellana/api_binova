import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ObservabilityService } from '../../common/observability/observability.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PUSH_GATEWAY, PushGateway } from '../../infrastructure/push/push.gateway';
import {
  PushNotificationType,
  PushResourceType,
} from '../../infrastructure/push/push.types';

export interface CreateNotificationInput {
  userId: string;
  type: PushNotificationType;
  title: string;
  body: string;
  resourceType: PushResourceType | null;
  resourceId: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_GATEWAY) private readonly pushGateway: PushGateway,
    private readonly observability: ObservabilityService,
  ) {}

  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateNotificationInput,
  ): Promise<string> {
    const notification = await tx.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
      select: { id: true },
    });
    return notification.id;
  }

  async dispatch(notificationId: string): Promise<void> {
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notification || !this.isPushType(notification.type)) return;

      const devices = await this.prisma.deviceRegistration.findMany({
        where: {
          userId: notification.userId,
          platform: 'android',
          revokedAt: null,
        },
        select: { id: true, pushToken: true },
      });
      const result = await this.pushGateway.send(
        {
          notificationId: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          resourceType: this.toResourceType(notification.resourceType),
          resourceId: notification.resourceId,
        },
        devices.map((device) => ({
          deviceId: device.id,
          pushToken: device.pushToken,
        })),
      );
      if (result.invalidDeviceIds.length > 0) {
        await this.prisma.deviceRegistration.updateMany({
          where: {
            id: { in: result.invalidDeviceIds },
            userId: notification.userId,
          },
          data: { revokedAt: new Date() },
        });
      }
      this.observability.recordPushDelivery(
        notification.id,
        result.sentDeviceIds.length,
        result.invalidDeviceIds.length,
        result.failedCount,
      );
    } catch {
      this.observability.recordPushDelivery(notificationId, 0, 0, 1);
    }
  }

  async createDevelopmentTest(userId: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: 'informational',
        title: 'Prueba de notificaciones',
        body: 'La integración push de BInova está activa.',
        resourceType: null,
        resourceId: null,
      },
    });
    await this.dispatch(notification.id);
    return this.toContract(notification);
  }

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

  private isPushType(value: string): value is PushNotificationType {
    return value === 'financial' || value === 'security' || value === 'informational';
  }

  private toResourceType(value: string | null): PushResourceType | null {
    if (
      value === 'transaction' ||
      value === 'account' ||
      value === 'card' ||
      value === 'session'
    ) {
      return value;
    }
    return null;
  }
}
