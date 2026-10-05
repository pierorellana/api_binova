import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get('accounts/:accountId/transactions')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId') accountId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('category') category: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const page = await this.service.list(user.userId, accountId, {
      cursor,
      limit: Math.min(Math.max(Number(limit ?? 20) || 20, 1), 50),
      category,
      from,
      to,
    });
    return success(page.items, request.correlationId, {
      nextCursor: page.nextCursor,
    });
  }

  @Get('transactions/:id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.get(user.userId, id),
      request.correlationId,
    );
  }
}
