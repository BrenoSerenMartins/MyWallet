import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import {
  ACCOUNT_READS,
  ACCOUNT_BALANCE_BASIS,
  type AccountBalanceBasis,
  LEDGER_READS,
  type AccountReads,
  type LedgerReads,
} from '../../../core/integration/index.js';
@Injectable()
export class DashboardService {
  constructor(
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(LEDGER_READS) private readonly ledger: LedgerReads,
    @Optional() @Inject(ACCOUNT_BALANCE_BASIS) private readonly balanceBasis?: AccountBalanceBasis,
  ) {}
  async history(month: string, months = 4) {
    if (!/^(?:19\d{2}|[2-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(month) || month.startsWith('9999'))
      throw new BadRequestException('Informe um mês válido entre 1900 e 9998.');
    if (![2, 4, 7, 12].includes(months))
      throw new BadRequestException('Escolha um intervalo de 2, 4, 7 ou 12 meses.');
    const [year, number] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, number - months, 1)).toISOString().slice(0, 10);
    const from = start < '1900-01-01' ? '1900-01-01' : start;
    const to = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
    return { items: await this.ledger.monthlySummary(from, to), from, to, months };
  }
  async summary(from: string, to: string) {
    await this.balanceBasis?.upgradeLegacyReferences();
    const accounts = (await this.accounts.list()).filter(
      (a) => !['credit_card', 'investment'].includes(a.type),
    );
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
