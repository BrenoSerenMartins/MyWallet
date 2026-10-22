import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
export function createApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('MyWallet API').setVersion('1.0').addBearerAuth().build(),
  );
}
