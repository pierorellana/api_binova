import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateTopupDto } from './dto/create-topup.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

type OperationType = 'transfer' | 'payment' | 'topup';

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listBeneficiaries(userId: string) {
    const beneficiaries = await this.prisma.beneficiary.findMany({
      where: { userId, status: 'active' },
      orderBy: { displayName: 'asc' },
    });
    return beneficiaries.map((beneficiary) => ({
      id: beneficiary.id,
      displayName: beneficiary.displayName,
      bankName: beneficiary.bankName,
      maskedAccountNumber: beneficiary.maskedAccountNumber,
      status: beneficiary.status,
    }));
  }

  /** Demo billers shown in Pagar servicios (amounts from the BInova prototype). */
  private static readonly demoBills: Record<string, { name: string; amount: string }> = {
    'luz-electrica': { name: 'Luz eléctrica', amount: '32.90' },
    'agua-potable': { name: 'Agua potable', amount: '14.75' },
    'internet-hogar': { name: 'Internet hogar', amount: '32.90' },
    'telefonia-movil': { name: 'Telefonía móvil', amount: '25.00' },
  };

  /** Next occurrence of `day` (this month if still ahead, otherwise next month). */
  private nextDay(day: number): Date {
    const now = new Date();
    const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    if (due.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
      due.setUTCMonth(due.getUTCMonth() + 1);
    }
    return due;
  }

  async getDebt(providerId: string, accountReference: string) {
    const normalizedProvider = providerId.trim();
    const normalizedReference = accountReference.trim();
    if (!normalizedProvider || !normalizedReference) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Proveedor y referencia son obligatorios.',
      });
    }
    const known = OperationsService.demoBills[normalizedProvider];
    return {
      providerId: normalizedProvider,
      providerName: known?.name ?? `${normalizedProvider} demo`,
      accountReference: normalizedReference,
      debtReference: this.debtReference(normalizedProvider, normalizedReference),
      amount: { amount: known?.amount ?? '20.00', currency: 'USD' },
      dueDate: (known ? this.nextDay(15) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        .toISOString()
        .slice(0, 10),
      status: 'payable',
    };
  }

  createTransfer(userId: string, input: CreateTransferDto, idempotencyKey: string) {
    return this.executeIdempotent(
      userId,
      'transfer',
      idempotencyKey,
      input,
      async (tx) => {
        const beneficiary = await tx.beneficiary.findFirst({
          where: { id: input.beneficiaryId, userId: userId, status: 'active' },
        });
        if (!beneficiary) {
          throw new NotFoundException({
            code: 'BENEFICIARY_NOT_FOUND',
            message: 'El beneficiario no existe.',
          });
        }
        return this.debitAndComplete(tx, {
          userId,
          sourceAccountId: input.sourceAccountId,
          amount: input.amount,
          operationType: 'transfer',
          category: 'transfer',
          description: `Transferencia a ${beneficiary.displayName}`,
          request: input,
        });
      },
    );
  }

  createPayment(userId: string, input: CreatePaymentDto, idempotencyKey: string) {
    return this.executeIdempotent(
      userId,
      'payment',
      idempotencyKey,
      input,
      async (tx) => {
        const expectedDebtReference = this.debtReference(
          input.providerId,
          input.accountReference,
        );
        if (input.debtReference !== expectedDebtReference) {
          throw new NotFoundException({
            code: 'DEBT_NOT_FOUND',
            message: 'La deuda consultada ya no está disponible.',
          });
        }
        return this.debitAndComplete(tx, {
          userId,
          sourceAccountId: input.sourceAccountId,
          amount: input.amount,
          operationType: 'payment',
          category: 'services',
          description: `Pago a ${input.providerId}`,
          request: input,
        });
      },
    );
  }

  createTopup(userId: string, input: CreateTopupDto, idempotencyKey: string) {
    return this.executeIdempotent(
      userId,
      'topup',
      idempotencyKey,
      input,
      (tx) =>
        this.debitAndComplete(tx, {
          userId,
          sourceAccountId: input.sourceAccountId,
          amount: input.amount,
          operationType: 'topup',
          category: 'topup',
          description: `Recarga ${input.operatorId} ${input.lineNumber}`,
          request: input,
        }),
    );
  }

  async getOperation(userId: string, id: string) {
    const operation = await this.prisma.financialOperation.findFirst({
      where: { id, userId },
    });
    if (!operation) {
      throw new NotFoundException({
        code: 'OPERATION_NOT_FOUND',
        message: 'La operación no existe.',
      });
    }
    return this.toContract(operation);
  }

  private async executeIdempotent<T extends object>(
    userId: string,
    operation: OperationType,
    idempotencyKey: string,
    input: T,
    create: (tx: Prisma.TransactionClient) => Promise<{
      id: string;
      operationType: string;
      status: string;
      amount: Prisma.Decimal | null;
      currency: string | null;
      resourceId: string | null;
      providerReference: string | null;
      failureCode: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length < 16 || key.length > 120) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key debe tener entre 16 y 120 caracteres.',
      });
    }
    const requestHash = this.hashRequest(input);
    const existing = await this.findIdempotency(userId, operation, key);
    if (existing) return this.resolveExisting(existing, requestHash);

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const inside = await tx.idempotencyKey.findUnique({
          where: { userId_operation_key: { userId, operation, key } },
          include: { operationRef: true },
        });
        if (inside) {
          return {
            contract: this.resolveExisting(inside, requestHash),
            notificationId: null,
          };
        }
        const created = await create(tx);
        const notificationId = await this.notifications.createInTransaction(tx, {
          userId,
          type: 'financial',
          title: 'Operación completada',
          body: 'Revisa el detalle en BInova.',
          resourceType: 'transaction',
          resourceId: created.resourceId,
        });
        await tx.idempotencyKey.create({
          data: {
            userId,
            operation,
            key,
            requestHash,
            operationId: created.id,
          },
        });
        return {
          contract: this.toContract(created),
          notificationId,
        };
      });
      if (outcome.notificationId) {
        await this.notifications.dispatch(outcome.notificationId);
      }
      return outcome.contract;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findIdempotency(userId, operation, key);
        if (raced) return this.resolveExisting(raced, requestHash);
      }
      throw error;
    }
  }

  private async debitAndComplete(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      sourceAccountId: string;
      amount: { amount: string; currency: string };
      operationType: OperationType;
      category: string;
      description: string;
      request: object;
    },
  ) {
    const amount = new Prisma.Decimal(input.amount.amount);
    if (amount.lte(0)) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'El monto debe ser mayor que cero.',
      });
    }
    const account = await tx.account.findFirst({
      where: { id: input.sourceAccountId, userId: input.userId },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'La cuenta de origen no existe.',
      });
    }
    if (account.status !== 'active' || account.currency !== input.amount.currency) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'La cuenta no puede procesar este monto.',
      });
    }
    if (account.availableBalance.lt(amount)) {
      throw new UnprocessableEntityException({
        code: 'INSUFFICIENT_FUNDS',
        message: 'La cuenta no tiene saldo disponible suficiente.',
      });
    }

    const updatedAccount = await tx.account.update({
      where: { id: account.id },
      data: {
        ledgerBalance: { decrement: amount },
        availableBalance: { decrement: amount },
      },
    });
    const reference = this.operationReference(new Date());
    const transaction = await tx.transaction.create({
      data: {
        accountId: account.id,
        kind: 'expense',
        description: input.description,
        category: input.category,
        amount,
        currency: input.amount.currency,
        status: 'succeeded',
        occurredAt: new Date(),
        reference,
      },
    });
    return tx.financialOperation.create({
      data: {
        userId: input.userId,
        operationType: input.operationType,
        status: 'succeeded',
        amount,
        currency: input.amount.currency,
        requestJson: input.request,
        resultJson: {
          accountId: updatedAccount.id,
          transactionId: transaction.id,
        },
        resourceId: transaction.id,
        providerReference: reference,
      },
    });
  }

  /** Receipt reference shown to the customer, e.g. `BI-261003-1052`. */
  private operationReference(at: Date): string {
    const two = (n: number) => String(n).padStart(2, '0');
    return `BI-${two(at.getFullYear() % 100)}${two(at.getMonth() + 1)}${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}`;
  }

  private async findIdempotency(userId: string, operation: string, key: string) {
    return this.prisma.idempotencyKey.findUnique({
      where: { userId_operation_key: { userId, operation, key } },
      include: { operationRef: true },
    });
  }

  private resolveExisting(
    existing: {
      requestHash: string;
      operationRef: {
        id: string;
        operationType: string;
        status: string;
        amount: Prisma.Decimal | null;
        currency: string | null;
        resourceId: string | null;
        providerReference: string | null;
        failureCode: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    },
    requestHash: string,
  ) {
    if (existing.requestHash !== requestHash || existing.operationRef === null) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'La clave ya fue utilizada con otra solicitud.',
      });
    }
    return this.toContract(existing.operationRef);
  }

  private toContract(operation: {
    id: string;
    operationType: string;
    status: string;
    amount: Prisma.Decimal | null;
    currency: string | null;
    resourceId: string | null;
    providerReference: string | null;
    failureCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: operation.id,
      operationType: operation.operationType,
      status: operation.status,
      amount: operation.amount && operation.currency
        ? { amount: operation.amount.toString(), currency: operation.currency }
        : null,
      resourceId: operation.resourceId,
      providerReference: operation.providerReference,
      failureCode: operation.failureCode,
      createdAt: operation.createdAt.toISOString(),
      updatedAt: operation.updatedAt.toISOString(),
    };
  }

  private hashRequest(input: object): string {
    return createHash('sha256')
      .update(JSON.stringify(this.canonicalize(input)))
      .digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (value !== null && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      return Object.keys(object)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.canonicalize(object[key]);
          return result;
        }, {});
    }
    return value;
  }

  private debtReference(providerId: string, accountReference: string): string {
    return `debt-${createHash('sha256')
      .update(`${providerId.trim()}:${accountReference.trim()}`)
      .digest('hex')
      .slice(0, 16)}`;
  }
}
