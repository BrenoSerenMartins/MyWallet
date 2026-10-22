import { DatabaseService } from './core/database/index.js';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { SafeErrorFilter } from './core/http/index.js';
export function configureApp(app: INestApplication) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", process.env.SUPABASE_URL ?? 'https://*.supabase.co'],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Request-Id', randomUUID());
    if (req.path.startsWith('/v1')) res.setHeader('Cache-Control', 'no-store');
    app.get(DatabaseService).withWorkspace(req.get('X-Workspace-Id'), next);
  });
  app.useGlobalFilters(new SafeErrorFilter());
  const staticPath = resolve(process.env.STATIC_DIRECTORY ?? '../app/dist');
  if (existsSync(staticPath)) {
    app.use(
      express.static(staticPath, {
        index: false,
        setHeaders: (res, file) =>
          res.setHeader(
            'Cache-Control',
            file.includes('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache',
          ),
      }),
    );
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (
        req.method === 'GET' &&
        !/^\/(v1|health|ready|docs|openapi.json)(\/|$)/.test(req.path) &&
        !req.path.includes('.')
      )
        res.sendFile(resolve(staticPath, 'index.html'));
      else next();
    });
  }
  app.enableShutdownHooks();
}
