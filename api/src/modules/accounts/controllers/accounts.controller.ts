import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AccountResourceDto } from '../../../core/integration/index.js';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { AccountsService } from '../services/accounts.service.js';
import { CreateAccountDto } from '../dto/create-account.dto.js';
@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/accounts')
export class AccountsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccountsService) private readonly accounts: AccountsService,
  ) {}
  @Get() @ApiOkResponse({ type: [AccountResourceDto] }) list(@Req() request: AuthenticatedRequest) {
    return this.db.forUser(request.identity.id, () => this.accounts.list());
  }
  @Get(':id') @ApiOkResponse({ type: AccountResourceDto }) find(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.accounts.find(requireUuid(id)));
  }
  @Post()
  @ApiCreatedResponse({ type: AccountResourceDto })
  @ApiBody({ type: CreateAccountDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const dto = await validateInput(CreateAccountDto, body);
    return this.db.forUser(r.identity.id, () => this.accounts.create(dto));
  }
  @Patch(':id')
  @ApiOkResponse({ type: AccountResourceDto })
  @ApiBody({ type: CreateAccountDto })
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
    @Body() body: unknown,
  ) {
    const dto = await validateInput(CreateAccountDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.accounts.update(requireUuid(id), dto, version),
    );
  }
}
