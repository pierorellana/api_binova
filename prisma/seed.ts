import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

if (existsSync('.env')) loadEnvFile();

const prisma = new PrismaClient();

// Demo data aligned with the BInova iOS prototype (BInova-Prototipo.html):
// Pierre Orellana · savings **** 4821 · current **** 1067 · credit **** 9284.
// The seed is idempotent: re-running it refreshes the demo rows in place.
const IDS = {
  savings: '7f8c2e26-cd0f-4bd3-a1f2-1f1f11111111',
  current: '7f8c2e26-cd0f-4bd3-a1f2-1f1f22222222',
  credit: '7f8c2e26-cd0f-4bd3-a1f2-1f1f33333333',
  debitCard: '6a6a7a32-4b0d-4b2e-9f2d-111111111111',
  creditCard: '6a6a7a32-4b0d-4b2e-9f2d-222222222222',
};

const BENEFICIARIES = [
  { id: '3b1e4c55-1d2a-4c3e-8f10-000000000001', displayName: 'Andrea Salazar', bankName: 'Banco Internacional', maskedAccountNumber: 'Ahorros **** 7710' },
  { id: '3b1e4c55-1d2a-4c3e-8f10-000000000002', displayName: 'Carmen Orellana', bankName: 'Banco Internacional', maskedAccountNumber: 'Ahorros **** 0835' },
  { id: '3b1e4c55-1d2a-4c3e-8f10-000000000003', displayName: 'Daniel Mora', bankName: 'Banco Pichincha', maskedAccountNumber: 'Corriente **** 5532' },
  { id: '3b1e4c55-1d2a-4c3e-8f10-000000000004', displayName: 'Lucía Paredes', bankName: 'Produbanco', maskedAccountNumber: 'Ahorros **** 2291' },
];

/** Local date `daysAgo` days back at hh:mm. */
function at(daysAgo: number, hours: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const TRANSACTIONS = [
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000001', kind: 'expense', description: 'Uber', category: 'transport', amount: '8.50', occurredAt: at(0, 8, 43), reference: 'BI-260310-8843' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000002', kind: 'expense', description: 'Cafetería', category: 'food', amount: '3.75', occurredAt: at(0, 7, 58), reference: 'BI-260310-7581' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000003', kind: 'income', description: 'Transferencia recibida', category: 'transfer', amount: '150.00', occurredAt: at(1, 18, 20), reference: 'BI-260210-1820' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000004', kind: 'expense', description: 'Supermercado', category: 'groceries', amount: '64.30', occurredAt: at(1, 12, 5), reference: 'BI-260210-1205' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000005', kind: 'expense', description: 'Plan de internet', category: 'services', amount: '32.90', occurredAt: at(1, 9, 10), reference: 'BI-260210-0910' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000006', kind: 'expense', description: 'Farmacia', category: 'shopping', amount: '18.60', occurredAt: at(3, 19, 42), reference: 'BI-260930-1942' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000007', kind: 'expense', description: 'Pago tarjeta de crédito', category: 'card_payment', amount: '250.00', occurredAt: at(3, 10, 15), reference: 'BI-260930-1015' },
  { id: '5d2f1a10-7b3c-4e5d-8a9b-000000000008', kind: 'income', description: 'Pago de nómina', category: 'income', amount: '1850.00', occurredAt: at(3, 8, 0), reference: 'BI-260930-0800' },
];

/** Local date in the month `monthsBack` months ago. */
function inMonth(monthsBack: number, day: number, hours: number, minutes: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsBack, day, hours, minutes);
}

/**
 * Spending history behind Insights (prototype: Oct $1,240.50, +12% vs Sep;
 * May–Sep 980 · 1,120 · 1,050 · 1,180 · 1,107.60). Current-month fillers are
 * dated before the visible movements so the list keeps the prototype order.
 */
function historyTransactions() {
  const oldestVisible = at(3, 8, 0);
  const filler = (n: number) => {
    const early = inMonth(0, 1, 0, 30 + n * 20);
    const beforeVisible = new Date(oldestVisible.getTime() - (n + 1) * 60 * 60 * 1000);
    return early < beforeVisible ? early : beforeVisible;
  };
  const current = [
    ['Supermercado', 'groceries', '182.40'],
    ['Restaurante', 'food', '96.35'],
    ['Panadería', 'food', '65.50'],
    ['Tienda de ropa', 'shopping', '189.90'],
    ['Librería', 'shopping', '89.90'],
    ['Luz eléctrica', 'services', '64.20'],
    ['Agua potable', 'services', '28.50'],
    ['Telefonía móvil', 'services', '96.00'],
    ['Gasolinera', 'transport', '120.00'],
    ['Uber', 'transport', '57.70'],
    ['Gimnasio', 'other', '72.00'],
    ['Suscripción streaming', 'other', '50.00'],
  ].map(([description, category, amount], n) => ({ description, category, amount, occurredAt: filler(n) }));
  const monthly: Array<[number, number]> = [[5, 980], [4, 1120], [3, 1050], [2, 1180], [1, 1107.6]];
  const past = monthly.flatMap(([back, total]) => {
    const groceries = Math.round(total * 0.4 * 100) / 100;
    const shopping = Math.round(total * 0.25 * 100) / 100;
    const services = Math.round(total * 0.2 * 100) / 100;
    const transport = Math.round((total - groceries - shopping - services) * 100) / 100;
    return [
      ['Supermercado', 'groceries', groceries, 12],
      ['Compras en línea', 'shopping', shopping, 16],
      ['Servicios básicos', 'services', services, 20],
      ['Gasolinera', 'transport', transport, 24],
    ].map(([description, category, amount, day]) => ({
      description: description as string,
      category: category as string,
      amount: (amount as number).toFixed(2),
      occurredAt: inMonth(back, day as number, 18, 30),
    }));
  });
  return [...current, ...past].map((t, n) => ({
    ...t,
    kind: 'expense',
    reference: `BI-HIST-${String(n + 1).padStart(3, '0')}`,
  }));
}

const NOTIFICATIONS = [
  { id: '9c0d7e11-5a4b-4c3d-9e2f-000000000001', type: 'security', title: 'Detectamos un nuevo inicio de sesión.', body: 'iPhone 16 Pro · Quito. ¿Fuiste tú?', resourceType: 'session', createdAt: at(0, 8, 12), read: false },
  { id: '9c0d7e11-5a4b-4c3d-9e2f-000000000002', type: 'financial', title: 'Pagaste $8.50 en Uber.', body: 'Con tu cuenta de ahorros **** 4821.', resourceType: 'transaction', resourceId: '5d2f1a10-7b3c-4e5d-8a9b-000000000001', createdAt: at(0, 8, 43), read: false },
  { id: '9c0d7e11-5a4b-4c3d-9e2f-000000000003', type: 'financial', title: 'Has recibido $150.00.', body: 'Transferencia de Andrea Salazar a tu cuenta **** 4821.', resourceType: 'transaction', resourceId: '5d2f1a10-7b3c-4e5d-8a9b-000000000003', createdAt: at(1, 18, 20), read: true },
  { id: '9c0d7e11-5a4b-4c3d-9e2f-000000000004', type: 'informational', title: 'Descubre nuevas opciones para organizar tus gastos.', body: 'Revisa en qué categorías gastas más este mes.', createdAt: at(4, 10, 0), read: true },
  { id: '9c0d7e11-5a4b-4c3d-9e2f-000000000005', type: 'security', title: 'Face ID se activó correctamente.', body: 'Puedes desactivarlo desde Perfil.', createdAt: at(5, 10, 0), read: true },
];

const DASHBOARD_CONFIG = {
  sections: [
    {
      id: 'balance',
      type: 'balance',
      order: 0,
      payload: {
        label: 'Saldo total',
        amount: '5430.20',
        currency: 'USD',
        income: '2150.00',
        expense: '1240.50',
        updatedLabel: 'Actualizado hace 1 min',
      },
    },
    {
      id: 'quick-actions',
      type: 'quick_actions',
      order: 1,
      payload: {
        actions: [
          { id: 'transfer', label: 'Transferir' },
          { id: 'payment', label: 'Pagar' },
          { id: 'topup', label: 'Recargar' },
        ],
      },
    },
  ],
};

async function main(): Promise<void> {
  const passwordHash = await hash('Demo1234!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@binova.local' },
    update: { passwordHash, displayName: 'Pierre Orellana' },
    create: {
      email: 'demo@binova.local',
      displayName: 'Pierre Orellana',
      segment: 'standard',
      passwordHash,
    },
  });

  const accounts = [
    { id: IDS.savings, type: 'savings', name: 'Cuenta de ahorros', maskedNumber: '**** 4821', ledgerBalance: '3912.45', availableBalance: '3840.20' },
    { id: IDS.current, type: 'current', name: 'Cuenta corriente', maskedNumber: '**** 1067', ledgerBalance: '1590.00', availableBalance: '1590.00' },
    { id: IDS.credit, type: 'credit', name: 'Tarjeta de crédito', maskedNumber: '**** 9284', ledgerBalance: '820.00', availableBalance: '2180.00' },
  ];
  for (const account of accounts) {
    const data = { ...account, userId: user.id, currency: 'USD', status: 'active' };
    await prisma.account.upsert({ where: { id: account.id }, update: data, create: data });
  }

  await prisma.profilePreferences.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const dashboard = await prisma.dashboardConfig.findFirst({
    where: { segment: user.segment, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (dashboard) {
    await prisma.dashboardConfig.update({ where: { id: dashboard.id }, data: { config: DASHBOARD_CONFIG } });
  } else {
    await prisma.dashboardConfig.create({
      data: { segment: user.segment, schemaVersion: 1, config: DASHBOARD_CONFIG, isActive: true },
    });
  }

  // Refresh the demo movements of the savings account (operations created
  // from the app keep their own references and are left untouched).
  await prisma.transaction.deleteMany({
    where: {
      accountId: IDS.savings,
      OR: [
        { reference: { startsWith: 'DEMO-' } },
        { reference: { startsWith: 'BI-HIST-' } },
        { reference: { in: TRANSACTIONS.map((t) => t.reference) } },
        { id: { in: TRANSACTIONS.map((t) => t.id) } },
      ],
    },
  });
  await prisma.transaction.createMany({
    data: [...TRANSACTIONS, ...historyTransactions()].map((t) => ({
      ...t,
      accountId: IDS.savings,
      currency: 'USD',
      status: 'succeeded',
    })),
  });

  await prisma.beneficiary.updateMany({
    where: { userId: user.id, displayName: 'Beneficiario demo' },
    data: { status: 'inactive' },
  });
  for (const beneficiary of BENEFICIARIES) {
    const data = { ...beneficiary, userId: user.id, currency: 'USD', status: 'active' };
    await prisma.beneficiary.upsert({ where: { id: beneficiary.id }, update: data, create: data });
  }

  for (const notification of NOTIFICATIONS) {
    const { read, ...rest } = notification;
    const data = { ...rest, userId: user.id, readAt: read ? notification.createdAt : null };
    await prisma.notification.upsert({ where: { id: notification.id }, update: data, create: data });
  }

  // Devices listed in Perfil › Dispositivos (prototype: iPhone 15 Pro · iPhone 16 Pro).
  const devices = [
    { pushToken: 'demo-device-iphone-15-pro', deviceLabel: 'iPhone 15 Pro', lastSeenAt: new Date() },
    { pushToken: 'demo-device-iphone-16-pro', deviceLabel: 'iPhone 16 Pro', lastSeenAt: at(0, 8, 12) },
  ];
  for (const device of devices) {
    await prisma.deviceRegistration.upsert({
      where: { userId_pushToken: { userId: user.id, pushToken: device.pushToken } },
      update: { deviceLabel: device.deviceLabel, lastSeenAt: device.lastSeenAt, revokedAt: null },
      create: { ...device, userId: user.id, platform: 'ios' },
    });
  }

  const cards = [
    { id: IDS.debitCard, accountId: IDS.savings, type: 'debit', productName: 'Tarjeta de débito', maskedPan: '•••• 3307', status: 'frozen', frozenAt: at(2, 9, 30) },
    { id: IDS.creditCard, accountId: IDS.credit, type: 'credit', productName: 'Tarjeta de crédito', maskedPan: '•••• 9284', status: 'active', frozenAt: null },
  ];
  for (const card of cards) {
    const data = { ...card, userId: user.id, isVirtual: false };
    await prisma.card.upsert({ where: { id: card.id }, update: data, create: data });
    await prisma.cardLimit.upsert({
      where: { cardId: card.id },
      update: {},
      create: {
        cardId: card.id,
        dailyPurchaseLimit: '1000.00',
        dailyWithdrawalLimit: '300.00',
        currency: 'USD',
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
