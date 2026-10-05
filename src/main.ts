import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiObservabilityInterceptor } from './common/observability/api-observability.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      json: true,
      logLevels: ['log', 'warn', 'error', 'fatal'],
    }),
  });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    app.get(ApiObservabilityInterceptor),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BInova API')
    .setDescription('Contrato REST versionado de BInova')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
