import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.get(user.userId),
      request.correlationId,
    );
  }
}
