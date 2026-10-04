import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { PrismaModule } from './infrastructure/database/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    TransactionsModule,
    DashboardModule,
    ProfileModule,
    NotificationsModule,
  ],
})
export class AppModule {}
