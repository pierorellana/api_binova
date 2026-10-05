import { Controller, Get, Module, Req } from '@nestjs/common';

import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('health')
export class HealthController {
  @Get()
  health(@Req() request: AuthenticatedRequest) {
    return success({ status: 'ok' }, request.correlationId);
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
