import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 安全头
  app.use(helmet());

  // 全局前缀 /api/v1
  app.setGlobalPrefix('api/v1');

  // CORS 白名单
  const corsOrigins = config.get<string[]>('corsOrigins') || [];
  app.enableCors({ origin: corsOrigins, credentials: true });

  // 全局校验管道：whitelist + transform
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 全局异常过滤器 → envelope
  app.useGlobalFilters(new AllExceptionsFilter());

  // 静态目录 uploads（缩略图 / 导出文件）
  const uploadDir = config.get<string>('uploadDir') || './uploads';
  for (const sub of ['thumbnails', 'exports']) {
    const dir = join(process.cwd(), uploadDir, sub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads' });

  // Swagger 默认仅在非生产环境启用；生产需显式 SWAGGER_ENABLED=true。
  const swaggerEnabled = config.get<boolean>('swaggerEnabled') ?? false;
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MIRA·弥画 API')
      .setDescription('AI 视觉设计工具后端接口文档（envelope + JWT）')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
  logger.log(`MIRA API 已启动: http://localhost:${port}/api/v1/health`);
  if (swaggerEnabled) logger.log(`Swagger: http://localhost:${port}/api/docs`);
}

void bootstrap();
