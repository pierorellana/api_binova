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

  await prisma.profilePreferences.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const dashboard = await prisma.dashboardConfig.findFirst({
    where: { segment: user.segment, isActive: true },
  });
  if (!dashboard) {
    await prisma.dashboardConfig.create({
      data: {
        segment: user.segment,
        schemaVersion: 1,
        config: {
          sections: [
            {
              id: 'balance',
              type: 'balance',
              order: 0,
              payload: {
                label: 'Saldo total',
                amount: '2450.00',
                currency: 'USD',
                updatedLabel: 'Actualizado recientemente',
              },
            },
            {
              id: 'quick-actions',
              type: 'quick_actions',
              order: 1,
              payload: {
                actions: [
                  { id: 'transfer', label: 'Transferir' },
                  { id: 'payment', label: 'Pagar servicio' },
                  { id: 'topup', label: 'Recargar línea' },
                ],
              },
            },
          ],
        },
        isActive: true,
      },
    });
  }

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

  const beneficiaryCount = await prisma.beneficiary.count({
    where: { userId: user.id },
  });
  if (beneficiaryCount === 0) {
    await prisma.beneficiary.create({
      data: {
        userId: user.id,
        displayName: 'Beneficiario demo',
        bankName: 'Banco Internacional',
        maskedAccountNumber: '**** 7788',
        currency: 'USD',
        status: 'active',
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
