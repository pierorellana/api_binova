import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { ProfileService } from './profile.service';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.listDevices(user.userId),
      request.correlationId,
    );
  }

  @Post()
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RegisterDeviceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.registerDevice(user.userId, input),
      request.correlationId,
    );
  }

  @Delete(':id')
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.revokeDevice(user.userId, id),
      request.correlationId,
    );
  }
}
