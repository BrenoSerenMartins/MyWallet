import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_READS,
  LEDGER_WRITES,
  type AccountReads,
  type LedgerWrites,
} from '../../../core/integration/index.js';
import { CounterpartiesService } from './counterparties.service.js';
import type {
  CounterpartyIdentifierDto,
  CounterpartyRelationDto,
  ToggleRuleDto,
} from '../dto/counterparty.dto.js';
@Injectable()
export class CounterpartyRulesWorkflow {
  constructor(
    @Inject(CounterpartiesService) private readonly agents: CounterpartiesService,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(LEDGER_WRITES) private readonly ledger: LedgerWrites,
  ) {}
  async link(agentId: string, input: CounterpartyIdentifierDto) {
    await this.accounts.find(input.accountId, true);
    await this.agents.linkIdentifier(agentId, input);
    return this.ledger.applyCounterpartyRelation(input.accountId, agentId);
  }
  async relate(agentId: string, input: CounterpartyRelationDto) {
    await this.accounts.find(input.accountId, true);
    const id = await this.agents.relate(agentId, input);
    return { id, ...(await this.ledger.applyClassificationRule(id)) };
  }
  async configure(id: string, input: ToggleRuleDto, version: number) {
    const rule = await this.agents.findRule(id);
    await this.accounts.find(rule.accountId, true);
    await this.agents.configureRule(id, input, version);
    return { id, ...(await this.ledger.applyClassificationRule(id)) };
  }
}
