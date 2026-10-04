import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map((account) => this.toContract(account));
  }

  async get(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'La cuenta no existe.',
      });
    }
    return this.toContract(account);
  }

  private toContract(account: {
    id: string;
    type: string;
    name: string;
    maskedNumber: string;
    currency: string;
    ledgerBalance: { toString(): string };
    availableBalance: { toString(): string };
    status: string;
    createdAt: Date;
  }) {
    return {
      id: account.id,
      type: account.type,
      name: account.name,
      maskedNumber: account.maskedNumber,
      currency: account.currency,
      ledgerBalance: {
        amount: account.ledgerBalance.toString(),
        currency: account.currency,
      },
      availableBalance: {
        amount: account.availableBalance.toString(),
        currency: account.currency,
      },
      status: account.status,
      lastUpdatedAt: account.createdAt.toISOString(),
    };
  }
}
