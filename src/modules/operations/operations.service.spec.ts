import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OperationsService } from './operations.service';

describe('OperationsService idempotency', () => {
  it('replays the same operation and rejects a changed request', async () => {
    let storedKey: any = null;
    let storedOperation: any = null;
    const now = new Date();
    const account = {
      id: 'account-1',
      userId: 'user-1',
      currency: 'USD',
      status: 'active',
      availableBalance: new Prisma.Decimal('100.00'),
      ledgerBalance: new Prisma.Decimal('100.00'),
    };
    const tx: any = {
      idempotencyKey: {
        findUnique: async () => storedKey,
        create: async ({ data }: any) => {
          storedKey = { ...data, operationRef: storedOperation };
          return storedKey;
        },
      },
      beneficiary: {
        findFirst: async () => ({
          id: 'beneficiary-1',
          displayName: 'Demo',
          status: 'active',
        }),
      },
      account: {
        findFirst: async () => account,
        update: async () => account,
      },
      transaction: {
        create: async () => ({ id: 'transaction-1' }),
      },
      financialOperation: {
        create: async ({ data }: any) => {
          storedOperation = {
            id: 'operation-1',
            ...data,
            failureCode: null,
            createdAt: now,
            updatedAt: now,
          };
          return storedOperation;
        },
      },
      notification: {
        create: async () => ({ id: 'notification-1' }),
      },
    };
    const prisma: any = {
      idempotencyKey: {
        findUnique: async () => storedKey,
      },
      $transaction: async (callback: (value: any) => Promise<unknown>) =>
        callback(tx),
    };
    const notifications = {
      createInTransaction: jest.fn().mockResolvedValue('notification-1'),
      dispatch: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationsService;
    const service = new OperationsService(
      prisma as PrismaService,
      notifications,
    );
    const input = {
      sourceAccountId: 'account-1',
      beneficiaryId: 'beneficiary-1',
      amount: { amount: '25.00', currency: 'USD' },
    };

    const first = await service.createTransfer('user-1', input, 'binova-key-000001');
    const replay = await service.createTransfer('user-1', input, 'binova-key-000001');

    expect(first.id).toBe('operation-1');
    expect(replay.id).toBe(first.id);
    expect(notifications.createInTransaction).toHaveBeenCalledTimes(1);
    expect(notifications.dispatch).toHaveBeenCalledTimes(1);
    await expect(
      service.createTransfer(
        'user-1',
        { ...input, amount: { amount: '30.00', currency: 'USD' } },
        'binova-key-000001',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
