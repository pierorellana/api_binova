import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import {
  getMessaging,
  type Messaging,
} from 'firebase-admin/messaging';

import { ObservabilityService } from '../../common/observability/observability.service';
import { PushGateway } from './push.gateway';
import {
  PushDeliveryResult,
  PushMessage,
  PushRecipient,
} from './push.types';

interface ServiceAccountFile {
  project_id: string;
  client_email: string;
  private_key: string;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential',
]);

@Injectable()
export class FirebaseMessagingGateway implements PushGateway {
  private readonly messaging: Messaging | null;

  constructor(
    private readonly config: ConfigService,
    private readonly observability: ObservabilityService,
  ) {
    this.messaging = this.initializeMessaging();
  }

  async send(
    message: PushMessage,
    recipients: readonly PushRecipient[],
  ): Promise<PushDeliveryResult> {
    const empty = {
      sentDeviceIds: [],
      invalidDeviceIds: [],
      failedCount: 0,
    } satisfies PushDeliveryResult;
    if (recipients.length === 0 || this.messaging === null) return empty;

    const startedAt = Date.now();
    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens: recipients.map((recipient) => recipient.pushToken),
        notification: {
          title: message.title,
          body: message.body,
        },
        data: {
          type: message.type,
          notificationId: message.notificationId,
          ...(message.resourceType
            ? { resourceType: message.resourceType }
            : {}),
          ...(message.resourceId ? { resourceId: message.resourceId } : {}),
        },
      });
      const sentDeviceIds: string[] = [];
      const invalidDeviceIds: string[] = [];
      let failedCount = 0;

      response.responses.forEach((result, index) => {
        if (result.success) {
          sentDeviceIds.push(recipients[index].deviceId);
          return;
        }
        const code = result.error?.code;
        if (code && INVALID_TOKEN_CODES.has(code)) {
          invalidDeviceIds.push(recipients[index].deviceId);
        } else {
          failedCount += 1;
        }
      });
      this.observability.recordDependency(
        'firebase_messaging',
        Date.now() - startedAt,
        failedCount === 0,
      );
      return { sentDeviceIds, invalidDeviceIds, failedCount };
    } catch (error) {
      const code = this.errorCode(error);
      this.observability.recordDependency(
        'firebase_messaging',
        Date.now() - startedAt,
        false,
        code,
      );
      return {
        sentDeviceIds: [],
        invalidDeviceIds: [],
        failedCount: recipients.length,
      };
    }
  }

  private initializeMessaging(): Messaging | null {
    if (!this.isEnabled()) return null;
    const serviceAccountPath = this.config.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );
    if (!serviceAccountPath) {
      if (this.isProduction()) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is required.');
      }
      return null;
    }

    const serviceAccount = this.readServiceAccount(serviceAccountPath);
    const app: App =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
        }),
      });
    return getMessaging(app);
  }

  private readServiceAccount(path: string): ServiceAccountFile {
    const parsed: unknown = JSON.parse(
      readFileSync(resolve(process.cwd(), path), 'utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ServiceAccountFile).project_id !== 'string' ||
      typeof (parsed as ServiceAccountFile).client_email !== 'string' ||
      typeof (parsed as ServiceAccountFile).private_key !== 'string'
    ) {
      throw new Error('Invalid Firebase service account configuration.');
    }
    return parsed as ServiceAccountFile;
  }

  private isEnabled(): boolean {
    return this.config.get<string>('PUSH_ENABLED') === 'true';
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private errorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return undefined;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
}
