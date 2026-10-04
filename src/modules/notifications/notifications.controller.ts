import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const page = await this.service.list(user.userId, {
      cursor,
      limit: Math.min(Math.max(Number(limit ?? 20) || 20, 1), 50),
      unreadOnly: unreadOnly === 'true',
    });
    return success(page.items, request.correlationId, page.nextCursor);
  }

  @Post(':id/read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.markRead(user.userId, id),
      request.correlationId,
    );
  }

  @Post('read-all')
  async markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.markAllRead(user.userId),
      request.correlationId,
    );
  }
}
