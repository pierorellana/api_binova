import { ConfigService } from '@nestjs/config';

import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

function request(): AuthenticatedRequest {
  return { correlationId: 'trace-1' } as AuthenticatedRequest;
}

describe('NotificationsController test route', () => {
  it('rejects the test route when it is disabled', async () => {
    const service = {
      createDevelopmentTest: jest.fn(),
    } as unknown as NotificationsService;
    const config = {
      get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService;
    const controller = new NotificationsController(service, config);

    await expect(
      controller.test(
        { userId: 'user-1', sessionId: 'session-1', email: 'demo@binova.test' },
        request(),
      ),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    expect(service.createDevelopmentTest).not.toHaveBeenCalled();
  });

  it('returns the API envelope when the test route is enabled', async () => {
    const service = {
      createDevelopmentTest: jest.fn().mockResolvedValue({
        id: 'notification-1',
        type: 'informational',
        title: 'Prueba de notificaciones',
        body: 'La integración push de BInova está activa.',
        resourceType: null,
        resourceId: null,
        read: false,
        createdAt: '2026-10-05T12:00:00.000Z',
      }),
    } as unknown as NotificationsService;
    const config = {
      get: jest.fn().mockReturnValue('true'),
    } as unknown as ConfigService;
    const controller = new NotificationsController(service, config);

    await expect(
      controller.test(
        { userId: 'user-1', sessionId: 'session-1', email: 'demo@binova.test' },
        request(),
      ),
    ).resolves.toMatchObject({
      data: expect.objectContaining({ id: 'notification-1' }),
      statusCode: 202,
      message: 'Notificación de prueba creada.',
      meta: { traceId: 'trace-1' },
    });
  });
});
