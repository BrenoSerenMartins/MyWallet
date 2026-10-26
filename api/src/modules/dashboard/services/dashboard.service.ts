import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_READS,
  LEDGER_READS,
  type AccountReads,
  type LedgerReads,
} from '../../../core/integration/index.js';
@Injectable()
export class DashboardService {
  constructor(
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(LEDGER_READS) private readonly ledger: LedgerReads,
  ) {}
  async summary(from: string, to: string) {
    const accounts = await this.accounts.list();
    const summary = await this.ledger.summary(from, to);
    return {
      ...summary,
      balance: accounts
        .filter((a) => !['benefit_food', 'benefit_meal', 'reserve'].includes(a.type))
        .reduce((sum, a) => sum + a.balance, 0),
      benefitBalance: accounts
        .filter((a) => ['benefit_food', 'benefit_meal'].includes(a.type))
        .reduce((sum, a) => sum + a.balance, 0),
      reserveBalance: accounts
        .filter((a) => a.type === 'reserve')
        .reduce((sum, a) => sum + a.balance, 0),
      recordedResources: accounts.reduce((sum, a) => sum + a.balance, 0),
      accounts,
      from,
      to,
      coverage: 'tracked-accounts',
    };
  }
}
