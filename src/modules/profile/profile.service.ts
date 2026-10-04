import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, segment: true },
    });
    if (!user) throw this.userNotFound();
    return user;
  }

  async getPreferences(userId: string) {
    return this.prisma.profilePreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: {
        hideBalance: true,
        reduceMotion: true,
        notificationsEnabled: true,
      },
    });
  }

  async updatePreferences(userId: string, input: UpdatePreferencesDto) {
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Debes enviar al menos una preferencia.',
      });
    }
    return this.prisma.profilePreferences.upsert({
      where: { userId },
      update: changes,
      create: { userId, ...changes },
      select: {
        hideBalance: true,
        reduceMotion: true,
        notificationsEnabled: true,
      },
    });
  }

  async listDevices(userId: string) {
    const devices = await this.prisma.deviceRegistration.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return devices.map((device) => this.toDevice(device));
  }

  async registerDevice(userId: string, input: RegisterDeviceDto) {
    const device = await this.prisma.deviceRegistration.upsert({
      where: {
        userId_pushToken: { userId, pushToken: input.pushToken },
      },
      update: {
        platform: input.platform,
        deviceLabel: input.deviceLabel,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
      create: {
        userId,
        platform: input.platform,
        pushToken: input.pushToken,
        deviceLabel: input.deviceLabel,
      },
    });
    return this.toDevice(device);
  }

  async revokeDevice(userId: string, id: string) {
    const device = await this.prisma.deviceRegistration.findFirst({
      where: { id, userId },
    });
    if (!device) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'El dispositivo no existe.',
      });
    }
    await this.prisma.deviceRegistration.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  private toDevice(device: {
    id: string;
    platform: string;
    deviceLabel: string | null;
    lastSeenAt: Date;
    revokedAt: Date | null;
  }) {
    return {
      id: device.id,
      platform: device.platform,
      deviceLabel: device.deviceLabel ?? 'Dispositivo móvil',
      lastSeenAt: device.lastSeenAt.toISOString(),
      active: device.revokedAt === null,
    };
  }

  private userNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'El usuario no existe.',
    });
  }
}
