import { Prisma } from '@prisma/client';

import { InsightsService } from './insights.service';

describe('InsightsService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('aggregates current expenses by category and compares the previous period', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    const prisma = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'previous-expense',
            kind: 'expense',
            category: 'shopping',
            amount: new Prisma.Decimal('50.00'),
            currency: 'USD',
            status: 'succeeded',
            occurredAt: new Date('2026-09-20T12:00:00.000Z'),
          },
          {
            id: 'current-income',
            kind: 'income',
            category: 'income',
            amount: new Prisma.Decimal('1000.00'),
            currency: 'USD',
            status: 'succeeded',
            occurredAt: new Date('2026-10-02T12:00:00.000Z'),
          },
          {
            id: 'current-expense-one',
            kind: 'expense',
            category: 'shopping',
            amount: new Prisma.Decimal('25.00'),
            currency: 'USD',
            status: 'succeeded',
            occurredAt: new Date('2026-10-02T13:00:00.000Z'),
          },
          {
            id: 'current-expense-two',
            kind: 'expense',
            category: 'transport',
            amount: new Prisma.Decimal('25.00'),
            currency: 'USD',
            status: 'succeeded',
            occurredAt: new Date('2026-10-03T13:00:00.000Z'),
          },
        ]),
      },
    };
    const service = new InsightsService(prisma as never);

    const result = await service.get('user-1', 'month');

    expect(result.totalIncome).toEqual({ amount: '1000.00', currency: 'USD' });
    expect(result.totalExpense).toEqual({ amount: '50.00', currency: 'USD' });
    expect(result.comparisonPercentage).toBe('0.00');
    expect(result.categories).toEqual([
      {
        category: 'shopping',
        amount: { amount: '25.00', currency: 'USD' },
        percentage: '50.00',
      },
      {
        category: 'transport',
        amount: { amount: '25.00', currency: 'USD' },
        percentage: '50.00',
      },
    ]);
  });

  it('returns an empty insight when there are no successful movements', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    const prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new InsightsService(prisma as never);

    const result = await service.get('user-1');

    expect(result.totalIncome).toEqual({ amount: '0.00', currency: 'USD' });
    expect(result.totalExpense).toEqual({ amount: '0.00', currency: 'USD' });
    expect(result.comparisonPercentage).toBeNull();
    expect(result.categories).toEqual([]);
  });
});
