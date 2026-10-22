import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { DataExportService } from '../services/data-export.service.js';
@ApiTags('Data export')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1')
export class DataExportController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(DataExportService) private readonly exports: DataExportService,
  ) {}
  @Get('exports') async export(
    @Req() r: AuthenticatedRequest,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const data = await this.db.forUser<unknown>(
      r.identity.id,
      () => (format === 'csv' ? this.exports.csv() : this.exports.backup()),
      true,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mywallet-backup.${format === 'csv' ? 'csv' : 'json'}"`,
    );
    if (format === 'csv') res.type('text/csv').send(data);
    else res.json(data);
  }
  @Post('restores') preview(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    return this.db.forUser(r.identity.id, () => this.exports.preview(body));
  }
  @Get('restores/:id') review(@Req() r: AuthenticatedRequest, @Param('id') id: string) {
    return this.db.forUser(r.identity.id, () => this.exports.review(requireUuid(id)));
  }
  @Post('restores/:id/confirmations') confirm(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.exports.confirm(requireUuid(id)));
  }
}
