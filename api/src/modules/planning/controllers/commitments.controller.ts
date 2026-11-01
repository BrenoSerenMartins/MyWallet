import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { SaveCommitmentDto, SettleCommitmentDto } from '../dto/commitments.dto.js';
import {
  CommitmentCandidateDto,
  CommitmentResolutionDto,
  CommitmentScheduleDto,
  CommitmentsSummaryDto,
} from '../dto/commitments-resource.dto.js';
import { CommitmentsService } from '../services/commitments.service.js';
import { commitmentToday } from '../services/commitment-calendar.js';
@ApiTags('Commitments')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/commitments')
export class CommitmentsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CommitmentsService) private readonly commitments: CommitmentsService,
  ) {}
  @Get() @ApiOkResponse({ type: CommitmentsSummaryDto }) summary(
    @Req() r: AuthenticatedRequest,
    @Query('month') month?: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.commitments.summary(month ?? commitmentToday().slice(0, 7)),
      true,
    );
  }
  @Post()
  @ApiBody({ type: SaveCommitmentDto })
  @ApiCreatedResponse({ type: CommitmentScheduleDto })
  async create(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(SaveCommitmentDto, body);
    return this.db.forUser(r.identity.id, () => this.commitments.create(dto, key));
  }
  @Patch(':id')
  @ApiBody({ type: SaveCommitmentDto })
  @ApiOkResponse({ type: CommitmentScheduleDto })
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
  ) {
    const dto = await validateInput(SaveCommitmentDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.commitments.update(requireUuid(id), dto, version),
    );
  }
  @Post(':id/end') @ApiOkResponse({ type: CommitmentScheduleDto }) end(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.commitments.end(requireUuid(id), version));
  }
  @Get(':id/occurrences/:date/candidates')
  @ApiOkResponse({ type: [CommitmentCandidateDto] })
  candidates(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('date') date: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.commitments.candidates(requireUuid(id), date, from, to),
      true,
    );
  }
  @Post(':id/occurrences/:date')
  @ApiBody({ type: SettleCommitmentDto })
  @ApiOkResponse({ type: CommitmentResolutionDto })
  async resolve(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('date') date: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(SettleCommitmentDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.commitments.resolve(requireUuid(id), date, dto, version, key),
    );
  }
}
