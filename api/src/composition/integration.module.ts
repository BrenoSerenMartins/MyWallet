import { Global, Module } from '@nestjs/common';
import {
  ACCOUNT_READS,
  CATEGORY_READS,
  LEDGER_WRITES,
  LEDGER_READS,
  COMMAND_RECEIPTS,
  ACCOUNT_BACKUP,
  CATEGORY_BACKUP,
  LEDGER_BACKUP,
} from '../core/integration/index.js';
import { AccountsModule, AccountsService } from '../modules/accounts/index.js';
import { CategoriesModule, CategoriesService } from '../modules/categories/index.js';
import { LedgerModule, LedgerService, IdempotencyService } from '../modules/ledger/index.js';
const bindings = [
  { provide: ACCOUNT_BACKUP, useExisting: AccountsService },
  { provide: CATEGORY_BACKUP, useExisting: CategoriesService },
  { provide: LEDGER_BACKUP, useExisting: LedgerService },
  { provide: ACCOUNT_READS, useExisting: AccountsService },
  { provide: CATEGORY_READS, useExisting: CategoriesService },
  { provide: LEDGER_WRITES, useExisting: LedgerService },
  { provide: LEDGER_READS, useExisting: LedgerService },
  { provide: COMMAND_RECEIPTS, useExisting: IdempotencyService },
];
@Global()
@Module({
  imports: [AccountsModule, CategoriesModule, LedgerModule],
  providers: bindings,
  exports: bindings.map((b) => b.provide),
})
export class IntegrationModule {}
