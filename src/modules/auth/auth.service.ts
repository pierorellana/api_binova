import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    segment: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<SessionData> {
    const user = await this.prisma.user.findUnique({
      where: { email: username.trim().toLowerCase() },
    });
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'El usuario o la contraseña no son válidos.',
      });
    }
    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<SessionData> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException({
        code: 'REFRESH_REVOKED',
        message: 'La sesión de renovación ya no es válida.',
      });
    }

    const next = await this.createSession(session.user, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastSeenAt: new Date() },
    });
    return next;
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), lastSeenAt: new Date() },
    });
  }

  private async createSession(user: User, rotatedFromId?: string): Promise<SessionData> {
    const accessTokenTtlSeconds = this.accessTokenTtlSeconds();
    const accessTokenExpiresAt = new Date(
      Date.now() + accessTokenTtlSeconds * 1000,
    );
    const refreshDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 7);
    const refreshTokenExpiresAt = new Date(
      Date.now() + refreshDays * 24 * 60 * 60 * 1000,
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        ...(rotatedFromId ? { rotatedFromId } : {}),
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTokenTtlSeconds,
      },
    );
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        segment: user.segment,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessTokenTtlSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_TTL', '15m').trim();
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const match = /^(\d+)\s*(s|m|h|d)$/.exec(raw);
    if (!match) return 15 * 60;
    const amount = Number(match[1]);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 900;
    return amount * multiplier;
  }

  static async hashPassword(password: string): Promise<string> {
    return hash(password, 10);
  }
}
