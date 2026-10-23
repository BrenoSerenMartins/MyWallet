import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ImportBatchResourceDto } from '../../../core/integration/index.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { ImportsService } from '../services/imports.service.js';
import { ReviewItemDto, ConfirmImportDto } from '../dto/import.dto.js';
@ApiTags('Imports')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/imports')
export class ImportsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ImportsService) private readonly imports: ImportsService,
  ) {}
  @Get() list(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.imports.list());
  }
  @Get(':id') @ApiOkResponse({ type: ImportBatchResourceDto }) get(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.imports.preview(requireUuid(id)));
  }
  @Post()
  @ApiCreatedResponse({ type: ImportBatchResourceDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 } }),
  )
  async upload(
    @Req() r: AuthenticatedRequest,
    @Body('accountId') accountId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new UnprocessableEntityException('Selecione um extrato em PDF, CSV ou XLSX.');
    requireUuid(accountId);
    const statement = await this.imports.extract(r.identity.id, file.buffer, file.originalname);
    return this.db.forUser(r.identity.id, () =>
      this.imports.upload(accountId, file.buffer, file.originalname, statement),
    );
  }
  @Patch(':id/items/:itemId')
  @ApiOkResponse({ type: ImportBatchResourceDto })
  @ApiBody({ type: ReviewItemDto })
  async review(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Headers('if-match') version: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(ReviewItemDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.imports.review(requireUuid(id), requireUuid(itemId), input, version),
    );
  }
  @Post(':id/classifications') @ApiBody({ type: ConfirmImportDto }) async classify(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(ConfirmImportDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.imports.classify(requireUuid(id), input.version),
    );
  }
  @Post(':id/confirmations') @ApiBody({ type: ConfirmImportDto }) async confirm(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(ConfirmImportDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.imports.confirm(requireUuid(id), input.version, key),
    );
  }
  @Post(':id/history')
  @ApiBody({ type: ConfirmImportDto })
  @ApiOkResponse({ type: ImportBatchResourceDto })
  async retainHistory(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ConfirmImportDto,
  ) {
    const input = await validateInput(ConfirmImportDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.imports.retainHistory(requireUuid(id), input.version),
    );
  }
  @Post(':id/reviews')
  @ApiBody({ type: ConfirmImportDto })
  @ApiOkResponse({ type: ImportBatchResourceDto })
  async reopenHistory(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ConfirmImportDto,
  ) {
    const input = await validateInput(ConfirmImportDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.imports.reopenHistory(requireUuid(id), input.version),
    );
  }
  @Post(':id/reversals') reverse(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.imports.reverse(requireUuid(id), version));
  }
}
