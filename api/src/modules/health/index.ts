import { Controller, Get, Inject, Module, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../../core/database/index.js';
@Controller()
class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get('health') health() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }
  @Get('ready') async ready(@Res({ passthrough: true }) response: Response) {
    const ready = await this.db.ready();
    if (!ready) response.status(503);
    return { status: ready ? 'ok' : 'degraded', database: ready ? 'ready' : 'unavailable' };
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
