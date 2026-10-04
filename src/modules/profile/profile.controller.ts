import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.getProfile(user.userId),
      request.correlationId,
    );
  }

  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.getPreferences(user.userId),
      request.correlationId,
    );
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdatePreferencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.updatePreferences(user.userId, input),
      request.correlationId,
    );
  }

}
