import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../../core/database/index.js';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { RecognitionService } from '../services/recognition.service.js';
import {
  RecognitionSelectionDto,
  RecognitionQueueDto,
  RecognitionPreviewDto,
} from '../dto/recognition.dto.js';
@ApiTags('Assisted review')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/recognition')
export class RecognitionController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RecognitionService) private readonly service: RecognitionService,
  ) {}
  @Get() @ApiOkResponse({ type: RecognitionQueueDto }) queue(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.service.queue(), true);
  }
  @Post('preview')
  @ApiBody({ type: RecognitionSelectionDto })
  @ApiOkResponse({ type: RecognitionPreviewDto })
  async preview(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const input = await validateInput(RecognitionSelectionDto, body);
    return this.db.forUser(r.identity.id, () => this.service.preview(input.signatures));
  }
  @Post('reject') @ApiBody({ type: RecognitionSelectionDto }) async reject(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = await validateInput(RecognitionSelectionDto, body);
    return this.db.forUser(r.identity.id, () => this.service.reject(input.signatures));
  }
  @Post(':id/confirm') confirm(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.service.confirm(requireUuid(id), key));
  }
  @Get('changes') changes(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.service.changes(), true);
  }
  @Post('changes/:id/undo') undo(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.service.undo(requireUuid(id), key));
  }
}
