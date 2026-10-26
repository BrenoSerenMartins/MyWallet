import { SettlementMatchResourceDto } from '../../../core/integration/index.js';
import { SettlementMatchingService } from '../services/settlement-matching.service.js';
import { ImportReprocessingService } from '../services/import-reprocessing.service.js';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ImportBatchResourceDto } from '../../../core/integration/index.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
import { ReviewItemDto, ConfirmImportDto, ReprocessImportDto } from '../dto/import.dto.js';
@ApiTags('Imports')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/imports')
export class ImportsController {
  constructor(
    @Inject(SettlementMatchingService) private readonly matching: SettlementMatchingService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ImportsService) private readonly imports: ImportsService,
    @Inject(ImportReprocessingService) private readonly reprocessing: ImportReprocessingService,
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
  @Get(':id/matches')
  @ApiOkResponse({ type: [SettlementMatchResourceDto] })
  matches(@Req() r: AuthenticatedRequest, @Param('id') id: string) {
    return this.db.forUser(r.identity.id, () => this.matching.preview(requireUuid(id)), true);
  }
  @Get('transaction-sources/:transactionId')
  @ApiOkResponse({ type: [SettlementMatchResourceDto] })
  transactionSources(@Req() r: AuthenticatedRequest, @Param('transactionId') id: string) {
    return this.db.forUser(
      r.identity.id,
      () => this.matching.transactionSources(requireUuid(id)),
      true,
    );
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
  @Post(':id/reprocess')
  @HttpCode(200)
  @ApiBody({ type: ReprocessImportDto })
  @ApiOkResponse({ type: ImportBatchResourceDto })
  async reprocess(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await validateInput(ReprocessImportDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.reprocessing.reprocess(requireUuid(id), input.version, {
        resetClassification: input.resetClassification,
      }),
    );
  }
  @Post(':id/reprocess-file')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ImportBatchResourceDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'version'],
      properties: {
        file: { type: 'string', format: 'binary' },
        version: { type: 'integer', minimum: 1 },
        resetClassification: { type: 'boolean' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 } }),
  )
  async reprocessFile(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('version') version: string,
    @Body('resetClassification') resetClassification: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new UnprocessableEntityException('Selecione o arquivo original.');
    requireUuid(id);
    const input = await validateInput(ReprocessImportDto, {
      version: Number(version),
      ...(resetClassification === undefined
        ? {}
        : {
            resetClassification:
              resetClassification === 'true'
                ? true
                : resetClassification === 'false'
                  ? false
                  : resetClassification,
          }),
    });
    await this.db.forUser(r.identity.id, () =>
      this.reprocessing.validateSource(id, input.version, file.buffer),
    );
    const statement = await this.imports.extract(r.identity.id, file.buffer, file.originalname);
    return this.db.forUser(r.identity.id, () =>
      this.reprocessing.reprocess(id, input.version, {
        source: { buffer: file.buffer, statement },
        resetClassification: input.resetClassification,
      }),
    );
  }
}
