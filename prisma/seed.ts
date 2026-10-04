import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await hash('Demo1234!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@binova.local' },
    update: { passwordHash },
    create: {
      email: 'demo@binova.local',
      displayName: 'Piero Demo',
      segment: 'standard',
      passwordHash,
    },
  });

  const account = await prisma.account.upsert({
    where: { id: '7f8c2e26-cd0f-4bd3-a1f2-1f1f11111111' },
    update: {},
    create: {
      id: '7f8c2e26-cd0f-4bd3-a1f2-1f1f11111111',
      userId: user.id,
      type: 'savings',
      name: 'Cuenta principal',
      maskedNumber: '**** 4421',
      currency: 'USD',
      ledgerBalance: '2450.00',
      availableBalance: '2180.00',
      status: 'active',
    },
  });

  const transactionCount = await prisma.transaction.count({
    where: { accountId: account.id },
  });
  if (transactionCount === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          kind: 'income',
          description: 'Depósito demo',
          category: 'income',
          amount: '2500.00',
          currency: 'USD',
          status: 'succeeded',
          occurredAt: new Date('2026-09-30T14:00:00.000Z'),
          reference: 'DEMO-0001',
        },
        {
          accountId: account.id,
          kind: 'expense',
          description: 'Compra demo',
          category: 'shopping',
          amount: '320.00',
          currency: 'USD',
          status: 'succeeded',
          occurredAt: new Date('2026-10-01T18:30:00.000Z'),
          reference: 'DEMO-0002',
        },
      ],
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
