import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

type InsightPeriod = 'week' | 'month' | 'year';

interface PeriodRange {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
}

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, requestedPeriod?: string) {
    const period = this.parsePeriod(requestedPeriod);
    const range = this.periodRange(period, new Date());
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        status: 'succeeded',
        occurredAt: {
          gte: range.previousStart,
          lt: range.currentEnd,
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });

    const current = transactions.filter(
      (transaction) => transaction.occurredAt >= range.currentStart,
    );
    const previous = transactions.filter(
      (transaction) => transaction.occurredAt < range.currentStart,
    );
    const currency = current[0]?.currency ?? previous[0]?.currency ?? 'USD';
    const totalIncome = this.sumByKind(current, 'income');
    const totalExpense = this.sumByKind(current, 'expense');
    const previousExpense = this.sumByKind(previous, 'expense');
    const categories = this.categoryTotals(current, totalExpense, currency);

    return {
      period,
      totalIncome: { amount: totalIncome.toFixed(2), currency },
      totalExpense: { amount: totalExpense.toFixed(2), currency },
      comparisonPercentage: this.comparisonPercentage(totalExpense, previousExpense),
      categories,
    };
  }

  private parsePeriod(value?: string): InsightPeriod {
    const period = value?.trim().toLowerCase() || 'month';
    if (period !== 'week' && period !== 'month' && period !== 'year') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'period debe ser week, month o year.',
      });
    }
    return period;
  }

  private periodRange(period: InsightPeriod, now: Date): PeriodRange {
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (period === 'year') {
      currentStart.setUTCMonth(0);
    } else if (period === 'month') {
      currentStart.setUTCDate(1);
    } else {
      const dayOfWeek = currentStart.getUTCDay();
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      currentStart.setUTCDate(currentStart.getUTCDate() - daysSinceMonday);
    }

    const currentEnd = new Date(currentStart);
    const previousStart = new Date(currentStart);
    if (period === 'year') {
      currentEnd.setUTCFullYear(currentEnd.getUTCFullYear() + 1);
      previousStart.setUTCFullYear(previousStart.getUTCFullYear() - 1);
    } else if (period === 'month') {
      currentEnd.setUTCMonth(currentEnd.getUTCMonth() + 1);
      previousStart.setUTCMonth(previousStart.getUTCMonth() - 1);
    } else {
      currentEnd.setUTCDate(currentEnd.getUTCDate() + 7);
      previousStart.setUTCDate(previousStart.getUTCDate() - 7);
    }

    return { currentStart, currentEnd, previousStart };
  }

  private sumByKind(
    transactions: Array<{ kind: string; amount: Prisma.Decimal }>,
    kind: 'income' | 'expense',
  ): Prisma.Decimal {
    return transactions
      .filter((transaction) => transaction.kind === kind)
      .reduce(
        (total, transaction) => total.add(transaction.amount),
        new Prisma.Decimal(0),
      );
  }

  private categoryTotals(
    transactions: Array<{
      kind: string;
      category: string;
      amount: Prisma.Decimal;
      currency: string;
    }>,
    totalExpense: Prisma.Decimal,
    currency: string,
  ) {
    const totals = new Map<string, Prisma.Decimal>();
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense') continue;
      totals.set(
        transaction.category,
        (totals.get(transaction.category) ?? new Prisma.Decimal(0)).add(transaction.amount),
      );
    }

    return [...totals.entries()]
      .sort(([, first], [, second]) => second.comparedTo(first))
      .map(([category, amount]) => ({
        category,
        amount: { amount: amount.toFixed(2), currency },
        percentage: totalExpense.isZero()
          ? '0.00'
          : amount.mul(100).div(totalExpense).toFixed(2),
      }));
  }

  private comparisonPercentage(
    currentExpense: Prisma.Decimal,
    previousExpense: Prisma.Decimal,
  ): string | null {
    if (previousExpense.isZero()) return null;
    return currentExpense
      .sub(previousExpense)
      .mul(100)
      .div(previousExpense)
      .toFixed(2);
  }
}
