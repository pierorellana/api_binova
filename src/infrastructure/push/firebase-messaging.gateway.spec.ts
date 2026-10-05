import { ConfigService } from '@nestjs/config';

import { ObservabilityService } from '../../common/observability/observability.service';
import { FirebaseMessagingGateway } from './firebase-messaging.gateway';

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({
    sendEachForMulticast: jest.fn(),
  })),
}));

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const mockCert = jest.mocked(cert);
const mockGetApps = jest.mocked(getApps);
const mockInitializeApp = jest.mocked(initializeApp);
const mockGetMessaging = jest.mocked(getMessaging);

function mockSendEachForMulticast(): jest.Mock {
  const result = mockGetMessaging.mock.results.at(-1);
  if (!result || result.type !== 'return') {
    throw new Error('Firebase messaging was not initialized.');
  }
  return result.value.sendEachForMulticast as jest.Mock;
}

function config(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function observability(): ObservabilityService {
  return {
    recordDependency: jest.fn(),
  } as unknown as ObservabilityService;
}

describe('FirebaseMessagingGateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockReturnValue({ name: '[DEFAULT]' } as never);
    mockCert.mockReturnValue({} as never);
  });

  it('returns a no-op result when push is disabled', async () => {
    const gateway = new FirebaseMessagingGateway(
      config({ PUSH_ENABLED: 'false' }),
      observability(),
    );

    await expect(
      gateway.send(
        {
          notificationId: 'notification-id',
          type: 'informational',
          title: 'Título seguro',
          body: 'Contenido seguro',
          resourceType: null,
          resourceId: null,
        },
        [{ deviceId: 'device-id', pushToken: 'token-value' }],
      ),
    ).resolves.toEqual({
      sentDeviceIds: [],
      invalidDeviceIds: [],
      failedCount: 0,
    });
    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockGetMessaging).not.toHaveBeenCalled();
  });

  it('maps invalid registration responses to device ids', async () => {
    const gateway = new FirebaseMessagingGateway(
      config({
        PUSH_ENABLED: 'true',
        FIREBASE_SERVICE_ACCOUNT_PATH:
          './binova-92083-firebase-adminsdk-fbsvc-9500400d3b.json',
      }),
      observability(),
    );
    const sendEachForMulticast = mockSendEachForMulticast();
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
        { success: false, error: { code: 'messaging/internal-error' } },
      ],
    });

    const result = await gateway.send(
      {
        notificationId: 'notification-id',
        type: 'financial',
        title: 'Operación completada',
        body: 'Revisa el detalle en BInova.',
        resourceType: 'transaction',
        resourceId: 'transaction-id',
      },
      [
        { deviceId: 'device-1', pushToken: 'token-1' },
        { deviceId: 'device-2', pushToken: 'token-2' },
        { deviceId: 'device-3', pushToken: 'token-3' },
      ],
    );

    expect(result).toEqual({
      sentDeviceIds: ['device-1'],
      invalidDeviceIds: ['device-2'],
      failedCount: 1,
    });
  });

  it('keeps message data limited to routing fields', async () => {
    const gateway = new FirebaseMessagingGateway(
      config({
        PUSH_ENABLED: 'true',
        FIREBASE_SERVICE_ACCOUNT_PATH:
          './binova-92083-firebase-adminsdk-fbsvc-9500400d3b.json',
      }),
      observability(),
    );
    const sendEachForMulticast = mockSendEachForMulticast();
    sendEachForMulticast.mockResolvedValue({
      responses: [{ success: true }],
    });

    await gateway.send(
      {
        notificationId: 'notification-id',
        type: 'financial',
        title: 'Operación completada',
        body: 'Revisa el detalle en BInova.',
        resourceType: 'transaction',
        resourceId: 'transaction-id',
      },
      [{ deviceId: 'device-id', pushToken: 'token-value' }],
    );

    expect(sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token-value'],
      notification: {
        title: 'Operación completada',
        body: 'Revisa el detalle en BInova.',
      },
      data: {
        type: 'financial',
        notificationId: 'notification-id',
        resourceType: 'transaction',
        resourceId: 'transaction-id',
      },
    });
  });

  it('does not throw when Firebase returns a provider failure', async () => {
    const gateway = new FirebaseMessagingGateway(
      config({
        PUSH_ENABLED: 'true',
        FIREBASE_SERVICE_ACCOUNT_PATH:
          './binova-92083-firebase-adminsdk-fbsvc-9500400d3b.json',
      }),
      observability(),
    );
    const sendEachForMulticast = mockSendEachForMulticast();
    sendEachForMulticast.mockRejectedValue({ code: 'messaging/internal-error' });

    await expect(
      gateway.send(
        {
          notificationId: 'notification-id',
          type: 'informational',
          title: 'Título seguro',
          body: 'Contenido seguro',
          resourceType: null,
          resourceId: null,
        },
        [{ deviceId: 'device-id', pushToken: 'token-value' }],
      ),
    ).resolves.toEqual({
      sentDeviceIds: [],
      invalidDeviceIds: [],
      failedCount: 1,
    });
  });
});
