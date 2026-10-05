import { Prisma } from '@prisma/client';

import { ObservabilityService } from '../../common/observability/observability.service';
import { PushGateway } from '../../infrastructure/push/push.gateway';
import { NotificationsService } from './notifications.service';

function notification() {
  return {
    id: 'notification-1',
    userId: 'user-1',
    type: 'financial',
    title: 'Operación completada',
    body: 'Revisa el detalle en BInova.',
    resourceType: 'transaction',
    resourceId: 'transaction-1',
    readAt: null,
    createdAt: new Date('2026-10-05T12:00:00.000Z'),
  };
}

describe('NotificationsService push dispatch', () => {
  it('creates a safe notification and dispatches only active Android devices', async () => {
    const stored = notification();
    const prisma = {
      notification: {
        create: jest.fn().mockResolvedValue(stored),
        findUnique: jest.fn().mockResolvedValue(stored),
      },
      deviceRegistration: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'device-1', pushToken: 'token-1' },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const pushGateway: PushGateway = {
      send: jest.fn().mockResolvedValue({
        sentDeviceIds: ['device-1'],
        invalidDeviceIds: [],
        failedCount: 0,
      }),
    };
    const observability = {
      recordPushDelivery: jest.fn(),
    } as unknown as ObservabilityService;
    const service = new NotificationsService(
      prisma as never,
      pushGateway,
      observability,
    );

    const result = await service.createDevelopmentTest('user-1');

    expect(result).toMatchObject({
      id: 'notification-1',
      type: 'financial',
    });
    expect(prisma.deviceRegistration.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', platform: 'android', revokedAt: null },
      select: { id: true, pushToken: true },
    });
    expect(pushGateway.send).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'notification-1',
        resourceType: 'transaction',
        resourceId: 'transaction-1',
      }),
      [{ deviceId: 'device-1', pushToken: 'token-1' }],
    );
  });

  it('revokes invalid device registrations', async () => {
    const stored = notification();
    const prisma = {
      notification: { findUnique: jest.fn().mockResolvedValue(stored) },
      deviceRegistration: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'device-1', pushToken: 'token-1' },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const pushGateway: PushGateway = {
      send: jest.fn().mockResolvedValue({
        sentDeviceIds: [],
        invalidDeviceIds: ['device-1'],
        failedCount: 0,
      }),
    };
    const service = new NotificationsService(
      prisma as never,
      pushGateway,
      { recordPushDelivery: jest.fn() } as unknown as ObservabilityService,
    );

    await service.dispatch('notification-1');

    expect(prisma.deviceRegistration.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['device-1'] }, userId: 'user-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('does not throw when delivery fails after persistence', async () => {
    const stored = notification();
    const recordPushDelivery = jest.fn();
    const service = new NotificationsService(
      {
        notification: { findUnique: jest.fn().mockResolvedValue(stored) },
        deviceRegistration: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'device-1', pushToken: 'token-1' },
          ]),
        },
      } as never,
      { send: jest.fn().mockRejectedValue(new Error('provider unavailable')) },
      { recordPushDelivery } as unknown as ObservabilityService,
    );

    await expect(service.dispatch('notification-1')).resolves.toBeUndefined();
    expect(recordPushDelivery).toHaveBeenCalledWith(
      'notification-1',
      0,
      0,
      1,
    );
  });

  it('creates notifications through the supplied Prisma transaction', async () => {
    const tx = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
    } as unknown as Prisma.TransactionClient;
    const service = new NotificationsService(
      {} as never,
      { send: jest.fn() },
      { recordPushDelivery: jest.fn() } as unknown as ObservabilityService,
    );

    await expect(
      service.createInTransaction(tx, {
        userId: 'user-1',
        type: 'financial',
        title: 'Operación completada',
        body: 'Revisa el detalle en BInova.',
        resourceType: 'transaction',
        resourceId: 'transaction-1',
      }),
    ).resolves.toBe('notification-1');
    expect(tx.notification.create).toHaveBeenCalled();
  });
});
