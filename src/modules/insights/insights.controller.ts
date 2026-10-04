import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('monthly')
  async getMonthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.get(user.userId, period),
      request.correlationId,
    );
  }
}
