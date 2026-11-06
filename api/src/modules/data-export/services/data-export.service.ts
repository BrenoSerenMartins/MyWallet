import { GoneException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  CARDS_BACKUP,
  WEALTH_BACKUP,
  type ManagedBackup,
  type CardsSnapshot,
  type WealthSnapshot,
  COMMITMENTS_BACKUP,
  type CommitmentsBackup,
  ACCOUNT_BALANCE_BASIS,
  type AccountBalanceBasis,
  COUNTERPARTY_RULES,
  type CounterpartyRules,
  PLANNING_BACKUP,
  type PlanningBackup,
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
    @Inject(PLANNING_BACKUP) private readonly planning: PlanningBackup,
    @Inject(COUNTERPARTY_RULES) private readonly counterparties: CounterpartyRules,
    @Inject(ACCOUNT_BALANCE_BASIS) private readonly balanceBasis: AccountBalanceBasis,
    @Optional() @Inject(COMMITMENTS_BACKUP) private readonly commitments?: CommitmentsBackup,
    @Optional() @Inject(CARDS_BACKUP) private readonly cards?: ManagedBackup<CardsSnapshot>,
    @Optional() @Inject(WEALTH_BACKUP) private readonly wealth?: ManagedBackup<WealthSnapshot>,
  ) {}
  async backup(): Promise<BackupPayload> {
    return {
      format: 'plannedwallet',
      version: 12,
      cards: (await this.cards?.exportManaged()) ?? {
        cards: [],
        bills: [],
        purchases: [],
        entries: [],
        payments: [],
      },
      wealth: (await this.wealth?.exportManaged()) ?? {
        holdings: [],
        events: [],
        items: [],
        history: [],
      },
      commitments: (await this.commitments?.exportCommitments()) ?? {
        schedules: [],
        occurrences: [],
      },
      balanceHistory: await this.balanceBasis.exportHistory(),
      counterparties: await this.counterparties.snapshot(),
      categoryGroups: await this.categories.exportGroups(),
      monthlyPlans: await this.planning.exportRecords(),
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
      monthlyPlans: payload.monthlyPlans?.length ?? 0,
      commitments: payload.commitments?.schedules.length ?? 0,
      cards: payload.cards?.cards.length ?? 0,
      investments: payload.wealth?.holdings.length ?? 0,
      wealthItems: payload.wealth?.items.length ?? 0,
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
      monthlyPlans: b.monthlyPlans?.length ?? 0,
      commitments: b.commitments?.schedules.length ?? 0,
      cards: b.cards?.cards.length ?? 0,
      investments: b.wealth?.holdings.length ?? 0,
      wealthItems: b.wealth?.items.length ?? 0,
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
      const groups = new Map<string, string>();
      for (const group of payload.categoryGroups ?? [])
        groups.set(group.id, await this.categories.restoreGroupRecord(group));
      for (const c of payload.categories)
        categories.set(
          c.id,
          await this.categories.restoreRecord({
            ...c,
            groupId: c.groupId ? groups.get(c.groupId)! : null,
          }),
        );
      const identities = await this.counterparties.restore(
        payload.counterparties ?? { agents: [], identifiers: [], rules: [] },
        accounts,
        categories,
      );
      const transactionIds = await this.ledger.restoreRecords(
        payload.transactions,
        accounts,
        categories,
        identities,
      );
      await this.balanceBasis.restoreBackup(
        payload.accounts,
        payload.transactions,
        payload.balanceHistory ?? [],
        accounts,
        transactionIds,
      );
      await this.planning.restoreRecords(payload.monthlyPlans ?? [], categories, accounts);
      if (payload.commitments?.schedules.length && !this.commitments)
        throw new Error('Commitment restore is unavailable.');
      await this.commitments?.restoreCommitments(
        payload.commitments ?? { schedules: [], occurrences: [] },
        accounts,
        categories,
        transactionIds,
      );
      if (
        (payload.cards?.cards.length && !this.cards) ||
        (payload.wealth?.holdings.length && !this.wealth) ||
        (payload.wealth?.items.length && !this.wealth)
      )
        throw new Error('Managed restore is unavailable.');
      if (payload.cards)
        await this.cards?.restoreManaged(payload.cards, accounts, categories, transactionIds);
      if (payload.wealth)
        await this.wealth?.restoreManaged(payload.wealth, accounts, categories, transactionIds);
      await this.repository.confirm(id);
      return {
        id,
        status: 'confirmed',
        accounts: accounts.size,
        transactions: payload.transactions.length,
        monthlyPlans: payload.monthlyPlans?.length ?? 0,
        commitments: payload.commitments?.schedules.length ?? 0,
        cards: payload.cards?.cards.length ?? 0,
        investments: payload.wealth?.holdings.length ?? 0,
        wealthItems: payload.wealth?.items.length ?? 0,
      };
    });
  }
}
