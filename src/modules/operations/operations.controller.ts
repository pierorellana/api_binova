import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateTopupDto } from './dto/create-topup.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { OperationsService } from './operations.service';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get('beneficiaries')
  async beneficiaries(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.listBeneficiaries(user.userId),
      request.correlationId,
    );
  }

  @Post('transfers')
  @HttpCode(HttpStatus.ACCEPTED)
  async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.createTransfer(user.userId, input, idempotencyKey ?? ''),
      request.correlationId,
    );
  }

  @Get('payments/debt')
  async debt(
    @Query('providerId') providerId: string,
    @Query('accountReference') accountReference: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.getDebt(providerId, accountReference),
      request.correlationId,
    );
  }

  @Post('payments')
  @HttpCode(HttpStatus.ACCEPTED)
  async payment(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatePaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.createPayment(user.userId, input, idempotencyKey ?? ''),
      request.correlationId,
    );
  }

  @Post('topups')
  @HttpCode(HttpStatus.ACCEPTED)
  async topup(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateTopupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.createTopup(user.userId, input, idempotencyKey ?? ''),
      request.correlationId,
    );
  }

  @Get('operations/:id')
  async operation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return success(
      await this.service.getOperation(user.userId, id),
      request.correlationId,
    );
  }
}
