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

  it('returns a six-month trend and leaves own credit card payments out of spending', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    const expense = (id: string, amount: string, occurredAt: string, category = 'groceries') => ({
      id,
      kind: 'expense',
      category,
      amount: new Prisma.Decimal(amount),
      currency: 'USD',
      status: 'succeeded',
      occurredAt: new Date(occurredAt),
    });
    const findMany = jest.fn().mockResolvedValue([
      expense('may', '980.00', '2026-05-15T12:00:00.000Z'),
      expense('sep', '100.00', '2026-09-15T12:00:00.000Z'),
      expense('oct', '112.00', '2026-10-02T12:00:00.000Z'),
      expense('card', '250.00', '2026-10-01T12:00:00.000Z', 'card_payment'),
    ]);
    const service = new InsightsService({ transaction: { findMany } } as never);

    const result = await service.get('user-1', 'month');

    expect(findMany.mock.calls[0][0].where.occurredAt.gte).toEqual(new Date('2026-05-01T00:00:00.000Z'));
    expect(result.totalExpense).toEqual({ amount: '112.00', currency: 'USD' });
    expect(result.comparisonPercentage).toBe('12.00');
    expect(result.trend.map((point) => [point.start, point.totalExpense.amount])).toEqual([
      ['2026-05-01', '980.00'],
      ['2026-06-01', '0.00'],
      ['2026-07-01', '0.00'],
      ['2026-08-01', '0.00'],
      ['2026-09-01', '100.00'],
      ['2026-10-01', '112.00'],
    ]);
  });
});
