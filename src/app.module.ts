import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { HealthModule } from './modules/health/health.module';
import { InsightsModule } from './modules/insights/insights.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { PushModule } from './infrastructure/push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ObservabilityModule,
    PushModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    TransactionsModule,
    DashboardModule,
    InsightsModule,
    ExchangeModule,
    ProfileModule,
    NotificationsModule,
    OperationsModule,
    CardsModule,
  ],
})
export class AppModule {}
