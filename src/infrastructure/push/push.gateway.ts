import { PushDeliveryResult, PushMessage, PushRecipient } from './push.types';

export const PUSH_GATEWAY = Symbol('PUSH_GATEWAY');

export interface PushGateway {
  send(
    message: PushMessage,
    recipients: readonly PushRecipient[],
  ): Promise<PushDeliveryResult>;
}
