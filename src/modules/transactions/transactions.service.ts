import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    accountId: string,
    options: {
      cursor?: string;
      limit: number;
      category?: string;
      from?: string;
      to?: string;
    },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) throw this.accountNotFound();

    const items = await this.prisma.transaction.findMany({
      where: {
        accountId,
        ...(options.category ? { category: options.category } : {}),
        ...(options.from || options.to
          ? {
              occurredAt: {
                ...(options.from ? { gte: new Date(options.from) } : {}),
                ...(options.to
                  ? { lte: new Date(`${options.to}T23:59:59.999Z`) }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
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

  async get(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, account: { userId } },
    });
    if (!transaction) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'El movimiento no existe.',
      });
    }
    return this.toContract(transaction);
  }

  private toContract(transaction: {
    id: string;
    kind: string;
    description: string;
    category: string;
    amount: { toString(): string };
    currency: string;
    status: string;
    occurredAt: Date;
    reference: string | null;
  }) {
    return {
      id: transaction.id,
      kind: transaction.kind,
      description: transaction.description,
      category: transaction.category,
      amount: {
        amount: transaction.amount.toString(),
        currency: transaction.currency,
      },
      status: transaction.status,
      occurredAt: transaction.occurredAt.toISOString(),
      reference: transaction.reference,
    };
  }

  private accountNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ACCOUNT_NOT_FOUND',
      message: 'La cuenta no existe.',
    });
  }
}
