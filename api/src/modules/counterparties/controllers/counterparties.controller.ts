import { CounterpartyRulesWorkflow } from '../services/counterparty-rules-workflow.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { CounterpartiesService } from '../services/counterparties.service.js';
import {
  CounterpartyResourceDto,
  CounterpartyIdentifierDto,
  CounterpartyLookupDto,
  CounterpartyCandidateDto,
  CreateCounterpartyDto,
  UpdateCounterpartyDto,
  ToggleRuleDto,
  CounterpartyRelationDto,
} from '../dto/counterparty.dto.js';
@ApiTags('Counterparties')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/counterparties')
export class CounterpartiesController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CounterpartiesService) private readonly service: CounterpartiesService,
    @Inject(CounterpartyRulesWorkflow) private readonly rules: CounterpartyRulesWorkflow,
  ) {}
  @Get() @ApiOkResponse({ type: [CounterpartyResourceDto] }) list(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.service.list(), true);
  }
  @Post() @ApiBody({ type: CreateCounterpartyDto }) async create(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = await validateInput(CreateCounterpartyDto, body);
    return this.db.forUser(r.identity.id, () => this.service.create(input.name));
  }
  @Post('suggestions')
  @ApiBody({ type: CounterpartyLookupDto })
  @ApiOkResponse({ type: [CounterpartyCandidateDto] })
  async suggestions(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const input = await validateInput(CounterpartyLookupDto, body);
    return this.db.forUser(r.identity.id, () => this.service.candidates(input), true);
  }
  @Post(':id/identifiers')
  @ApiBody({ type: CounterpartyIdentifierDto })
  async link(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await validateInput(CounterpartyIdentifierDto, body);
    return this.db.forUser(r.identity.id, () => this.rules.link(requireUuid(id), input));
  }
  @Patch(':id') @ApiBody({ type: UpdateCounterpartyDto }) async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(UpdateCounterpartyDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.service.update(requireUuid(id), input.name, input.enabled, Number(version)),
    );
  }
  @Post(':id/relations') @ApiBody({ type: CounterpartyRelationDto }) async relate(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(CounterpartyRelationDto, body);
    return this.db.forUser(r.identity.id, () => this.rules.relate(requireUuid(id), input));
  }
  @Delete(':agent/identifiers/:id') removeIdentifier(
    @Req() r: AuthenticatedRequest,
    @Param('agent') agent: string,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.service.removeIdentifier(requireUuid(agent), requireUuid(id)),
    );
  }
  @Patch('rules/:id') @ApiBody({ type: ToggleRuleDto }) async toggleRule(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(ToggleRuleDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.rules.configure(requireUuid(id), input, Number(version)),
    );
  }
}
