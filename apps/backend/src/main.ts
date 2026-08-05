import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { getCurrentUserId, HeaderLike } from './common/request-user.helper';
import { RequestContextService } from './common/request-context.service';
import { requestLoggerMiddleware } from './common/logging/request-logger.middleware';
import { requestIdMiddleware } from './common/request-id.middleware';
import { QueryFilterInterceptor } from './modules/tenant/query-filter.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((item) => item.trim()) : true
  });
  app.use(requestIdMiddleware);
  const requestContextService = app.get(RequestContextService);
  app.use((req: { headers: HeaderLike; requestId?: string }, _res: unknown, next: () => void) => {
    requestContextService.run(
      {
        userId: getCurrentUserId(req.headers),
        requestId: req.requestId
      },
      next
    );
  });
  app.use(requestLoggerMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(app.get(QueryFilterInterceptor), new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  );

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AgriOS API')
    .setDescription('AgriOS county-level agricultural digitization platform API')
    .setVersion('V1')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

void bootstrap();
