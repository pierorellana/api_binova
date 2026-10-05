import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateVirtualCardDto } from './dto/create-virtual-card.dto';
import { UpdateCardLimitsDto } from './dto/update-card-limits.dto';
import { WalletProvisioningDto } from './dto/wallet-provisioning.dto';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const cards = await this.prisma.card.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return cards.map((card) => this.toCard(card));
  }

  async get(userId: string, id: string) {
    const card = await this.findCard(userId, id);
    return this.toCard(card);
  }

  async createVirtualCard(
    userId: string,
    input: CreateVirtualCardDto,
    idempotencyKey: string,
  ) {
    const key = this.requireKey(idempotencyKey);
    const requestHash = this.hashRequest(input);
    const existing = await this.findIdempotency(userId, 'virtual_card_creation', key);
    if (existing) return this.resolveOperation(existing, requestHash);

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const inside = await tx.idempotencyKey.findUnique({
          where: {
            userId_operation_key: {
              userId,
              operation: 'virtual_card_creation',
              key,
            },
          },
          include: { operationRef: true },
        });
        if (inside) {
          return {
            operation: this.resolveOperation(inside, requestHash),
            notificationId: null,
          };
        }

        if (input.fundingAccountId) {
          const account = await tx.account.findFirst({
            where: {
              id: input.fundingAccountId,
              userId,
              status: 'active',
            },
          });
          if (!account) {
            throw new UnprocessableEntityException({
              code: 'CARD_NOT_ELIGIBLE',
              message: 'La cuenta seleccionada no puede crear esta tarjeta.',
            });
          }
        }
        const card = await tx.card.create({
          data: {
            userId,
            accountId: input.fundingAccountId,
            type: 'virtual',
            productName: 'BInova Virtual',
            maskedPan: `•••• ${randomInt(1000, 10000)}`,
            status: 'active',
            isVirtual: true,
          },
        });
        const operation = await tx.financialOperation.create({
          data: {
            userId,
            operationType: 'virtual_card_creation',
            status: 'succeeded',
            requestJson: { ...input },
            resultJson: { cardId: card.id },
            resourceId: card.id,
            providerReference: 'demo-virtual-card',
          },
        });
        const notificationId = await this.notifications.createInTransaction(tx, {
          userId,
          type: 'informational',
          title: 'Tarjeta virtual creada',
          body: 'Tu tarjeta virtual ya está disponible en BInova.',
          resourceType: 'card',
          resourceId: card.id,
        });
        await tx.idempotencyKey.create({
          data: {
            userId,
            operation: 'virtual_card_creation',
            key,
            requestHash,
            operationId: operation.id,
          },
        });
        return {
          operation: this.toOperation(operation),
          notificationId,
        };
      });
      if (outcome.notificationId) {
        await this.notifications.dispatch(outcome.notificationId);
      }
      return outcome.operation;
    } catch (error) {
      if (this.isUniqueError(error)) {
        const raced = await this.findIdempotency(userId, 'virtual_card_creation', key);
        if (raced) return this.resolveOperation(raced, requestHash);
      }
      throw error;
    }
  }

  async freeze(userId: string, id: string) {
    const card = await this.findCard(userId, id);
    if (card.status === 'frozen') {
      throw new UnprocessableEntityException({
        code: 'CARD_ALREADY_FROZEN',
        message: 'La tarjeta ya está congelada.',
      });
    }
    if (card.status === 'blocked') {
      throw new UnprocessableEntityException({
        code: 'CARD_NOT_ELIGIBLE',
        message: 'La tarjeta no puede cambiar de estado.',
      });
    }
    return this.toCard(
      await this.prisma.card.update({
        where: { id },
        data: { status: 'frozen', frozenAt: new Date() },
      }),
    );
  }

  async unfreeze(userId: string, id: string) {
    const card = await this.findCard(userId, id);
    if (card.status === 'active') {
      throw new UnprocessableEntityException({
        code: 'CARD_ALREADY_ACTIVE',
        message: 'La tarjeta ya está activa.',
      });
    }
    if (card.status !== 'frozen') {
      throw new UnprocessableEntityException({
        code: 'CARD_NOT_ELIGIBLE',
        message: 'La tarjeta no puede reactivarse.',
      });
    }
    return this.toCard(
      await this.prisma.card.update({
        where: { id },
        data: { status: 'active', frozenAt: null },
      }),
    );
  }

  async getLimits(userId: string, cardId: string) {
    const card = await this.findCard(userId, cardId, true);
    const limits = card.limits ??
        (await this.prisma.cardLimit.create({
          data: {
            cardId,
            dailyPurchaseLimit: '1000.00',
            dailyWithdrawalLimit: '300.00',
            currency: card.account?.currency ?? 'USD',
          },
        }));
    return this.toLimits(limits);
  }

  async updateLimits(userId: string, cardId: string, input: UpdateCardLimitsDto) {
    if (!input.dailyPurchaseLimit && !input.dailyWithdrawalLimit) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Debes enviar al menos un límite.',
      });
    }
    const card = await this.findCard(userId, cardId, true);
    const currency = card.account?.currency ??
      input.dailyPurchaseLimit?.currency ??
      input.dailyWithdrawalLimit?.currency ??
      'USD';
    for (const value of [input.dailyPurchaseLimit, input.dailyWithdrawalLimit]) {
      if (value && value.currency !== currency) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          message: 'La moneda del límite no coincide con la tarjeta.',
        });
      }
    }
    const current = card.limits;
    const limits = await this.prisma.cardLimit.upsert({
      where: { cardId },
      update: {
        ...(input.dailyPurchaseLimit
          ? { dailyPurchaseLimit: input.dailyPurchaseLimit.amount }
          : {}),
        ...(input.dailyWithdrawalLimit
          ? { dailyWithdrawalLimit: input.dailyWithdrawalLimit.amount }
          : {}),
        currency,
      },
      create: {
        cardId,
        dailyPurchaseLimit: input.dailyPurchaseLimit?.amount ??
          current?.dailyPurchaseLimit ?? '1000.00',
        dailyWithdrawalLimit: input.dailyWithdrawalLimit?.amount ??
          current?.dailyWithdrawalLimit ?? '300.00',
        currency,
      },
    });
    return this.toLimits(limits);
  }

  async provisionWallet(
    userId: string,
    cardId: string,
    input: WalletProvisioningDto,
    idempotencyKey: string,
  ) {
    const key = this.requireKey(idempotencyKey);
    const requestHash = this.hashRequest({ cardId, ...input });
    const existing = await this.findIdempotency(userId, 'wallet_provisioning', key);
    if (existing) return this.resolveWallet(existing, requestHash);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const inside = await tx.idempotencyKey.findUnique({
          where: { userId_operation_key: { userId, operation: 'wallet_provisioning', key } },
          include: { operationRef: true },
        });
        if (inside) return this.resolveWallet(inside, requestHash);
        const card = await tx.card.findFirst({ where: { id: cardId, userId } });
        if (!card) throw this.cardNotFound();
        if (card.status !== 'active') {
          throw new UnprocessableEntityException({
            code: 'CARD_NOT_ELIGIBLE',
            message: 'La tarjeta no puede enviarse a Wallet.',
          });
        }
        const provisioning = await tx.walletProvisioning.create({
          data: {
            cardId,
            userId,
            wallet: input.wallet,
            status: 'succeeded',
            providerReference: 'demo-apple-wallet',
          },
        });
        const operation = await tx.financialOperation.create({
          data: {
            userId,
            operationType: 'wallet_provisioning',
            status: 'succeeded',
            requestJson: { cardId, ...input },
            resultJson: { provisioningId: provisioning.id },
            resourceId: cardId,
            providerReference: 'demo-apple-wallet',
          },
        });
        await tx.idempotencyKey.create({
          data: {
            userId,
            operation: 'wallet_provisioning',
            key,
            requestHash,
            operationId: operation.id,
          },
        });
        return this.toWallet(provisioning);
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const raced = await this.findIdempotency(userId, 'wallet_provisioning', key);
        if (raced) return this.resolveWallet(raced, requestHash);
      }
      throw error;
    }
  }

  private async findCard(userId: string, id: string, includeDetails = false) {
    const card = await this.prisma.card.findFirst({
      where: { id, userId },
      ...(includeDetails ? { include: { limits: true, account: true } } : {}),
    });
    if (!card) throw this.cardNotFound();
    return card as any;
  }

  private toCard(card: {
    id: string;
    type: string;
    productName: string;
    maskedPan: string;
    status: string;
    isVirtual: boolean;
    createdAt: Date;
    frozenAt: Date | null;
  }) {
    return {
      id: card.id,
      type: card.type,
      productName: card.productName,
      maskedPan: card.maskedPan,
      status: card.status,
      isVirtual: card.isVirtual,
      createdAt: card.createdAt.toISOString(),
      frozenAt: card.frozenAt?.toISOString() ?? null,
    };
  }

  private toLimits(limits: {
    cardId: string;
    dailyPurchaseLimit: Prisma.Decimal;
    dailyWithdrawalLimit: Prisma.Decimal;
    currency: string;
    updatedAt: Date;
  }) {
    return {
      cardId: limits.cardId,
      dailyPurchaseLimit: {
        amount: limits.dailyPurchaseLimit.toString(),
        currency: limits.currency,
      },
      dailyWithdrawalLimit: {
        amount: limits.dailyWithdrawalLimit.toString(),
        currency: limits.currency,
      },
      updatedAt: limits.updatedAt.toISOString(),
    };
  }

  private toWallet(provisioning: {
    id: string;
    cardId: string;
    wallet: string;
    status: string;
    provisioningUrl: string | null;
    createdAt: Date;
  }) {
    return {
      id: provisioning.id,
      cardId: provisioning.cardId,
      wallet: provisioning.wallet,
      status: provisioning.status,
      provisioningUrl: provisioning.provisioningUrl,
      createdAt: provisioning.createdAt.toISOString(),
    };
  }

  private toOperation(operation: {
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

  private async findIdempotency(userId: string, operation: string, key: string) {
    return this.prisma.idempotencyKey.findUnique({
      where: { userId_operation_key: { userId, operation, key } },
      include: { operationRef: true },
    });
  }

  private resolveOperation(
    existing: { requestHash: string; operationRef: any },
    requestHash: string,
  ) {
    if (existing.requestHash !== requestHash || !existing.operationRef) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'La clave ya fue utilizada con otra solicitud.',
      });
    }
    return this.toOperation(existing.operationRef);
  }

  private async resolveWallet(
    existing: { requestHash: string; operationRef: any },
    requestHash: string,
  ) {
    if (existing.requestHash !== requestHash || !existing.operationRef) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'La clave ya fue utilizada con otra solicitud.',
      });
    }
    const result = existing.operationRef.resultJson as { provisioningId?: string };
    if (!result.provisioningId) throw new ConflictException();
    const provisioning = await this.prisma.walletProvisioning.findUnique({
      where: { id: result.provisioningId },
    });
    if (!provisioning) throw new NotFoundException();
    return this.toWallet(provisioning);
  }

  private requireKey(key: string): string {
    const normalized = key?.trim();
    if (!normalized || normalized.length < 16 || normalized.length > 120) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key debe tener entre 16 y 120 caracteres.',
      });
    }
    return normalized;
  }

  private hashRequest(value: object): string {
    return createHash('sha256')
      .update(JSON.stringify(this.canonicalize(value)))
      .digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (value !== null && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      return Object.keys(object).sort().reduce<Record<string, unknown>>((result, key) => {
        result[key] = this.canonicalize(object[key]);
        return result;
      }, {});
    }
    return value;
  }

  private isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private cardNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'La tarjeta no existe.',
    });
  }
}
