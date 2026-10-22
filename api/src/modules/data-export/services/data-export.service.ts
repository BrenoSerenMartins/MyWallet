import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ACCOUNT_BACKUP,
  CATEGORY_BACKUP,
  LEDGER_BACKUP,
  COMMAND_RECEIPTS,
  type AccountBackup,
  type CategoryBackup,
  type LedgerBackup,
  type CommandReceipts,
  type BackupPayload,
} from '../../../core/integration/index.js';
import { RestoreRepository } from '../repositories/restore.repository.js';
import { validateBackup } from './backup-validation.js';
@Injectable()
export class DataExportService {
  constructor(
    @Inject(ACCOUNT_BACKUP) private readonly accounts: AccountBackup,
    @Inject(CATEGORY_BACKUP) private readonly categories: CategoryBackup,
    @Inject(LEDGER_BACKUP) private readonly ledger: LedgerBackup,
    @Inject(COMMAND_RECEIPTS) private readonly receipts: CommandReceipts,
    @Inject(RestoreRepository) private readonly repository: RestoreRepository,
  ) {}
  async backup(): Promise<BackupPayload> {
    return {
      format: 'mywallet',
      version: 1,
      currency: 'BRL',
      exportedAt: new Date().toISOString(),
      accounts: await this.accounts.exportRecords(),
      categories: await this.categories.exportRecords(),
      transactions: await this.ledger.exportRecords(),
    };
  }
  async csv() {
    const b = await this.backup();
    const escape = (v: unknown) =>
      '"' +
      (typeof v === 'string' ? v.replace(/^[\s]*[=+@-]/, "'$&") : String(v ?? '')).replaceAll(
        '"',
        '""',
      ) +
      '"';
    return (
      '\uFEFF' +
      [
        ['date', 'description', 'amount_minor', 'type', 'account_id'],
        ...b.transactions.map((t) => [
          t.transactionDate,
          t.description,
          t.amount,
          t.transactionType,
          t.accountId,
        ]),
      ]
        .map((row) => row.map(escape).join(';'))
        .join('\r\n')
    );
  }
  async preview(raw: unknown) {
    const payload = validateBackup(raw);
    const id = await this.repository.create(payload);
    return {
      id,
      status: 'draft',
      accounts: payload.accounts.length,
      categories: payload.categories.length,
      transactions: payload.transactions.length,
    };
  }
  async review(id: string) {
    const draft = await this.repository.find(id);
    if (!draft) throw new NotFoundException('Restauração não encontrada.');
    if (draft.status === 'confirmed') return { id, status: 'confirmed' };
    if (new Date(draft.expires_at).getTime() <= Date.now())
      throw new GoneException('A revisão expirou.');
    const b = validateBackup(draft.payload);
    return {
      id,
      status: 'draft',
      accounts: b.accounts.length,
      categories: b.categories.length,
      transactions: b.transactions.length,
    };
  }
  async confirm(id: string) {
    const draft = await this.repository.find(id);
    if (!draft) throw new NotFoundException('Restauração não encontrada.');
    if (draft.status === 'confirmed') return { id, status: 'confirmed' };
    if (new Date(draft.expires_at).getTime() <= Date.now())
      throw new GoneException('A revisão expirou.');
    const payload = validateBackup(draft.payload);
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.receipts.execute('restore', fingerprint, { fingerprint }, async () => {
      const accounts = new Map<string, string>();
      const categories = new Map<string, string>();
      for (const a of payload.accounts) accounts.set(a.id, await this.accounts.restoreRecord(a));
      for (const c of payload.categories)
        categories.set(c.id, await this.categories.restoreRecord(c));
      await this.ledger.restoreRecords(payload.transactions, accounts, categories);
      await this.repository.confirm(id);
      return {
        id,
        status: 'confirmed',
        accounts: accounts.size,
        transactions: payload.transactions.length,
      };
    });
  }
}
