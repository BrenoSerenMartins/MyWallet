import { GoalsModule, GoalsService } from '../modules/goals/index.js';
import { CardsModule, CardsService } from '../modules/cards/index.js';
import { WealthModule, WealthService } from '../modules/wealth/index.js';
import { CounterpartiesModule, CounterpartiesService } from '../modules/counterparties/index.js';
import { Global, Module } from '@nestjs/common';
import {
  MANAGED_ACCOUNTS,
  MANAGED_LEDGER,
  PLANNING_READS,
  COMMITMENT_READS,
  GOALS_READS,
  GOALS_BACKUP,
  CARD_FORECAST,
  CARD_IMPORT_PAYMENTS,
  CARDS_BACKUP,
  WEALTH_BACKUP,
  COMMITMENT_LEDGER,
  COMMITMENTS_BACKUP,
  COUNTERPARTY_RULES,
  PLANNING_BACKUP,
  ACCOUNT_BALANCE_BASIS,
  ACCOUNT_READS,
  CATEGORY_READS,
  LEDGER_WRITES,
  LEDGER_READS,
  COMMAND_RECEIPTS,
  ACCOUNT_BACKUP,
  CATEGORY_BACKUP,
  LEDGER_BACKUP,
} from '../core/integration/index.js';
import { AccountsModule, AccountsService, BalanceBasisService } from '../modules/accounts/index.js';
import { CategoriesModule, CategoriesService } from '../modules/categories/index.js';
import { LedgerModule, LedgerService, IdempotencyService } from '../modules/ledger/index.js';
import { PlanningModule, PlanningService, CommitmentsService } from '../modules/planning/index.js';
const bindings = [
  { provide: PLANNING_READS, useExisting: PlanningService },
  { provide: COMMITMENT_READS, useExisting: CommitmentsService },
  { provide: GOALS_READS, useExisting: GoalsService },
  { provide: GOALS_BACKUP, useExisting: GoalsService },
  { provide: MANAGED_ACCOUNTS, useExisting: AccountsService },
  { provide: MANAGED_LEDGER, useExisting: LedgerService },
  { provide: CARD_FORECAST, useExisting: CardsService },
  { provide: CARD_IMPORT_PAYMENTS, useExisting: CardsService },
  { provide: CARDS_BACKUP, useExisting: CardsService },
  { provide: WEALTH_BACKUP, useExisting: WealthService },
  { provide: COMMITMENT_LEDGER, useExisting: LedgerService },
  { provide: COMMITMENTS_BACKUP, useExisting: CommitmentsService },
  { provide: COUNTERPARTY_RULES, useExisting: CounterpartiesService },
  { provide: PLANNING_BACKUP, useExisting: PlanningService },
  { provide: ACCOUNT_BACKUP, useExisting: AccountsService },
  { provide: CATEGORY_BACKUP, useExisting: CategoriesService },
  { provide: LEDGER_BACKUP, useExisting: LedgerService },
  { provide: ACCOUNT_BALANCE_BASIS, useExisting: BalanceBasisService },
  { provide: ACCOUNT_READS, useExisting: AccountsService },
  { provide: CATEGORY_READS, useExisting: CategoriesService },
  { provide: LEDGER_WRITES, useExisting: LedgerService },
  { provide: LEDGER_READS, useExisting: LedgerService },
  { provide: COMMAND_RECEIPTS, useExisting: IdempotencyService },
];
@Global()
@Module({
  imports: [
    GoalsModule,
    CardsModule,
    WealthModule,
    CounterpartiesModule,
    AccountsModule,
    CategoriesModule,
    LedgerModule,
    PlanningModule,
  ],
  providers: bindings,
  exports: bindings.map((b) => b.provide),
})
export class IntegrationModule {}
