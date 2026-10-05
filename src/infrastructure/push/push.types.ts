export type PushNotificationType =
  | 'financial'
  | 'security'
  | 'informational';

export type PushResourceType =
  | 'transaction'
  | 'account'
  | 'card'
  | 'session';

export interface PushMessage {
  notificationId: string;
  type: PushNotificationType;
  title: string;
  body: string;
  resourceType: PushResourceType | null;
  resourceId: string | null;
}

export interface PushRecipient {
  deviceId: string;
  pushToken: string;
}

export interface PushDeliveryResult {
  sentDeviceIds: string[];
  invalidDeviceIds: string[];
  failedCount: number;
}
