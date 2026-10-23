import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { Configuration } from './core/config/index.js';
import { createApiDocument } from './core/openapi/index.js';
const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
app.useBodyParser('json', { limit: '5mb' });
configureApp(app);
if (process.env.NODE_ENV !== 'production' || process.env.DOCS_ENABLED === 'true')
  SwaggerModule.setup('docs', app, createApiDocument(app), { jsonDocumentUrl: 'openapi.json' });
const port = app.get(Configuration).port;
await app.listen(port, '0.0.0.0');
Logger.log(`HTTP listening on 0.0.0.0:${port}; readiness endpoint: /ready.`, 'Bootstrap');
