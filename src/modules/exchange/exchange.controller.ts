import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { ExchangeService } from './exchange.service';

@ApiTags('Exchange')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('exchange-rates')
export class ExchangeController {
  constructor(private readonly service: ExchangeService) {}

  @Get()
  async getRate(
    @CurrentUser() _user: AuthenticatedUser,
    @Query('base') base = 'USD',
    @Query('quote') quote = 'EUR',
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.getRate(base, quote),
      request.correlationId,
    );
  }
}
