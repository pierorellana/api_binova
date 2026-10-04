import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  login(@Body() input: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.service
      .login(input.username, input.password)
      .then((data) => success(data, request.correlationId));
  }

  @Post('refresh')
  refresh(@Body() input: RefreshDto, @Req() request: AuthenticatedRequest) {
    return this.service
      .refresh(input.refreshToken)
      .then((data) => success(data, request.correlationId));
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.service.logout(user.userId, user.sessionId);
    return success({ revoked: true }, request.correlationId);
  }
}
