import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { success } from '../../common/responses/api-response';
import { AuthenticatedRequest, AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateVirtualCardDto } from './dto/create-virtual-card.dto';
import { UpdateCardLimitsDto } from './dto/update-card-limits.dto';
import { WalletProvisioningDto } from './dto/wallet-provisioning.dto';
import { CardsService } from './cards.service';

@ApiTags('Cards')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(await this.service.list(user.userId), request.correlationId);
  }

  @Post('virtual')
  @HttpCode(HttpStatus.ACCEPTED)
  async createVirtual(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateVirtualCardDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.createVirtualCard(
        user.userId,
        input,
        idempotencyKey ?? '',
      ),
      request.correlationId,
      { statusCode: HttpStatus.ACCEPTED, message: 'Operación recibida.' },
    );
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(await this.service.get(user.userId, id), request.correlationId);
  }

  @Post(':id/freeze')
  @HttpCode(HttpStatus.OK)
  async freeze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(await this.service.freeze(user.userId, id), request.correlationId);
  }

  @Post(':id/unfreeze')
  @HttpCode(HttpStatus.OK)
  async unfreeze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(await this.service.unfreeze(user.userId, id), request.correlationId);
  }

  @Get(':id/limits')
  async getLimits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.getLimits(user.userId, id),
      request.correlationId,
    );
  }

  @Patch(':id/limits')
  async updateLimits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCardLimitsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.updateLimits(user.userId, id, input),
      request.correlationId,
    );
  }

  @Post(':id/wallet-provisioning')
  @HttpCode(HttpStatus.ACCEPTED)
  async provisionWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: WalletProvisioningDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.provisionWallet(
        user.userId,
        id,
        input,
        idempotencyKey ?? '',
      ),
      request.correlationId,
      { statusCode: HttpStatus.ACCEPTED, message: 'Operación recibida.' },
    );
  }
}
