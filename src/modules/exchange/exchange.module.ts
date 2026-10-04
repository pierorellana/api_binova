import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { DemoFxProvider } from './demo-fx-provider';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';
import { FX_PROVIDER } from './fx-provider';
import { HttpFxProvider } from './http-fx-provider';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [ExchangeController],
  providers: [
    DemoFxProvider,
    HttpFxProvider,
    {
      provide: FX_PROVIDER,
      inject: [ConfigService, DemoFxProvider, HttpFxProvider],
      useFactory: (
        config: ConfigService,
        demoProvider: DemoFxProvider,
        httpProvider: HttpFxProvider,
      ) =>
        config.get<string>('FX_PROVIDER_BASE_URL', '').trim()
          ? httpProvider
          : demoProvider,
    },
    ExchangeService,
  ],
})
export class ExchangeModule {}
