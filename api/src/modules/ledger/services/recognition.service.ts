import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import {
  ACCOUNT_READS,
  CATEGORY_READS,
  COUNTERPARTY_RULES,
  CARD_FORECAST,
  CARD_IMPORT_PAYMENTS,
  type AccountReads,
  type CategoryReads,
  type CounterpartyRules,
  type CardForecast,
  type CardImportPayments,
} from '../../../core/integration/index.js';
import { transactionResource } from '../mappers/transaction.mapper.js';
import { IdempotencyService } from './idempotency.service.js';
type Choice = {
  signature: string;
  transactionId: string;
  description: string;
  amount: number;
  date: string;
  accountName: string;
  explanation: string;
  counterpartyName: string | null;
  categoryName: string | null;
  cardName: string | null;
  billMonth: string | null;
  version: number;
  accountId: string;
  counterpartyId: string | null;
  categoryId: string | null;
  cardId: string | null;
  transactionType: string;
  classificationRuleId: string | null;
};
@Injectable()
export class RecognitionService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
    @Inject(COUNTERPARTY_RULES) private readonly counterparties: CounterpartyRules,
    @Inject(CARD_FORECAST) private readonly cards: CardForecast,
    @Inject(CARD_IMPORT_PAYMENTS) private readonly payments: CardImportPayments,
    @Inject(IdempotencyService) private readonly receipts: IdempotencyService,
  ) {}
  async queue() {
    const records = await this.db.query(
      `SELECT * FROM wallet.transactions t WHERE user_id=$1 AND reversed_at IS NULL AND category_id IS NULL AND NOT category_choice_explicit AND managed_kind IS NULL AND transfer_group_id IS NULL AND refund_of_id IS NULL AND balance_adjustment IS NULL AND transaction_type IN ('income','expense','unclassified') AND NOT EXISTS(SELECT 1 FROM wallet.financial_accounts a WHERE a.id=t.account_id AND (a.archived_at IS NOT NULL OR a.type IN ('credit_card','investment'))) AND NOT EXISTS(SELECT 1 FROM wallet.transactions r WHERE r.refund_of_id=t.id AND r.reversed_at IS NULL) ORDER BY transaction_date DESC,id LIMIT 500`,
      [this.db.userId],
    );
    const accounts = await this.accounts.list(),
      categories = (await this.categories.list()).filter((c) => !c.archived),
      state = await this.counterparties.snapshot(),
      rejected = await this.db.query(
        'SELECT signature FROM wallet.recognition_decisions WHERE user_id=$1',
        [this.db.userId],
      ),
      ignored = new Set(rejected.map((r) => r.signature));
    const through = new Date();
    through.setUTCMonth(through.getUTCMonth() + 1);
    through.setUTCDate(0);
    const bills = await this.cards.pendingBills(through.toISOString().slice(0, 10)),
      items: Choice[] = [];
    const recognized = new Map<string, Awaited<ReturnType<CounterpartyRules['suggest']>>[number]>();
    const groups = new Map<string, typeof records>();
    for (const r of records) {
      const key = r.account_id + ':' + (r.source_kind ?? 'manual');
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    for (const rows of groups.values()) {
      const entries = rows.map((r) => {
        const t = transactionResource(r);
        return {
          description: t.description,
          transactionType:
            t.transactionType === 'unclassified'
              ? t.amount > 0
                ? ('income' as const)
                : ('expense' as const)
              : t.transactionType,
          ...(t.counterpartyId ? { counterpartyId: t.counterpartyId } : {}),
        };
      });
      const suggestions = await this.counterparties.suggest(
        rows[0].account_id,
        rows[0].source_kind ?? 'manual',
        entries,
      );
      rows.forEach((r, i) => recognized.set(r.id, suggestions[i]));
    }
    for (const row of records) {
      const t = transactionResource(row),
        account = accounts.find((a) => a.id === t.accountId)!;
      const type =
        t.transactionType === 'unclassified'
          ? t.amount > 0
            ? 'income'
            : 'expense'
          : t.transactionType;
      const suggestion = recognized.get(t.id)!;
      const add = (part: Partial<Choice>) => {
        const c: Choice = {
          transactionId: t.id,
          version: t.version,
          accountId: t.accountId,
          description: t.description,
          amount: t.amount,
          date: t.transactionDate,
          accountName: account.name,
          transactionType: type,
          counterpartyId: t.counterpartyId,
          classificationRuleId: null,
          categoryId: null,
          cardId: null,
          billMonth: null,
          counterpartyName: null,
          categoryName: null,
          cardName: null,
          explanation: '',
          signature: '',
          ...part,
        };
        c.signature = createHash('sha256').update(JSON.stringify(c)).digest('hex');
        if (!ignored.has(c.signature)) items.push(c);
      };
      const ids = suggestion.counterpartyId
        ? [
            {
              counterpartyId: suggestion.counterpartyId,
              name: state.agents.find((a) => a.id === suggestion.counterpartyId)?.name ?? '',
              reason: 'exact',
            },
          ]
        : (suggestion.counterpartySuggestions ?? []);
      for (const candidate of ids) {
        const rule = state.rules.find(
          (r) =>
            r.enabled &&
            r.accountId === t.accountId &&
            r.counterpartyId === candidate.counterpartyId &&
            state.agents.some((a) => a.id === candidate.counterpartyId && a.enabled) &&
            r.transactionType === type &&
            categories.some((c) => c.id === r.categoryId),
        );
        if (!rule && t.counterpartyId) continue;
        add({
          counterpartyId: candidate.counterpartyId,
          counterpartyName: candidate.name,
          categoryId: rule?.categoryId ?? null,
          categoryName: categories.find((c) => c.id === rule?.categoryId)?.name ?? null,
          classificationRuleId: rule?.id ?? null,
          explanation:
            candidate.reason === 'exact'
              ? 'Identificação exata e regra cadastrada para esta conta.'
              : 'Nome ou descrição semelhante. Confirme a pessoa antes de aplicar.',
        });
      }
      if (!items.some((i) => i.transactionId === t.id && i.categoryId)) {
        const id =
          type === 'income' ? account.defaultIncomeCategoryId : account.defaultExpenseCategoryId;
        const category = categories.find((c) => c.id === id && c.type === type);
        if (category)
          add({
            categoryId: category.id,
            categoryName: category.name,
            explanation:
              'Categoria padrão configurada nesta conta; aplicação opcional ao histórico.',
          });
      }
      if (t.amount < 0 && !['benefit_food', 'benefit_meal'].includes(account.type))
        for (const b of bills)
          if (
            b.amount === -t.amount &&
            Math.abs(Date.parse(b.dueDate) - Date.parse(t.transactionDate)) <= 7 * 86400000
          )
            add({
              cardId: b.cardId,
              billMonth: b.billMonth,
              cardName: b.description,
              explanation:
                'Valor igual ao saldo pendente da fatura e data a até 7 dias do vencimento. Ao confirmar, vira pagamento de cartão, sem repetir a despesa.',
            });
    }
    return { items, scanned: records.length };
  }
  private async chosen(signatures: string[]) {
    const queue = await this.queue(),
      items = signatures.map((s) => queue.items.find((c) => c.signature === s));
    if (items.some((i) => !i) || new Set(items.map((i) => i!.transactionId)).size !== items.length)
      throw new ConflictException(
        'Uma sugestão mudou ou há duas escolhas para o mesmo lançamento. Atualize a revisão.',
      );
    return items as Choice[];
  }
  async preview(signatures: string[]) {
    const items = await this.chosen(signatures),
      id = randomUUID();
    await this.db.query(
      'INSERT INTO wallet.recognition_previews(id,user_id,actor_id,payload) VALUES($1,$2,$3,$4)',
      [id, this.db.userId, this.db.actorId, JSON.stringify(items)],
    );
    return { id, items };
  }
  async reject(signatures: string[]) {
    for (const item of await this.chosen(signatures))
      await this.db.query(
        'INSERT INTO wallet.recognition_decisions(id,user_id,transaction_id,signature,actor_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,workspace_id,transaction_id,signature) DO NOTHING',
        [randomUUID(), this.db.userId, item.transactionId, item.signature, this.db.actorId],
      );
    return { status: 'rejected' };
  }
  async confirm(id: string, key: string) {
    return this.receipts.execute('recognition.confirm', key, { id }, async () => {
      const [preview] = await this.db.query(
        'SELECT * FROM wallet.recognition_previews WHERE id=$1 AND user_id=$2 AND actor_id=$3 AND expires_at>clock_timestamp() FOR UPDATE',
        [id, this.db.userId, this.db.actorId],
      );
      if (!preview || preview.confirmed_at)
        throw new NotFoundException('Prévia encerrada. Revise as sugestões novamente.');
      const items = await this.chosen((preview.payload as Choice[]).map((c) => c.signature));
      for (const id of [...new Set(items.map((c) => c.accountId))].sort())
        await this.accounts.find(id, true);
      for (const c of items) {
        const [t] = await this.db.query(
          'SELECT * FROM wallet.transactions WHERE user_id=$1 AND id=$2 FOR UPDATE',
          [this.db.userId, c.transactionId],
        );
        if (
          !t ||
          t.version !== c.version ||
          t.reversed_at ||
          t.category_id ||
          t.managed_kind ||
          t.transfer_group_id
        )
          throw new ConflictException(
            'O lançamento mudou. Nenhuma sugestão deste lote foi aplicada.',
          );
        if (c.cardId) {
          await this.payments.validateImportedPayment(
            c.cardId,
            c.billMonth!,
            c.accountId,
            Math.abs(c.amount),
          );
          await this.payments.linkImportedPayment(
            c.cardId,
            c.billMonth!,
            c.transactionId,
            key + ':' + c.transactionId,
          );
        } else {
          await this.db.query(
            'UPDATE wallet.transactions SET counterparty_id=$3,category_id=$4,transaction_type=$5,classification_rule_id=$6,version=version+1 WHERE user_id=$1 AND id=$2',
            [
              this.db.userId,
              c.transactionId,
              c.counterpartyId,
              c.categoryId,
              c.transactionType,
              c.classificationRuleId,
            ],
          );
          await this.db.query(
            'INSERT INTO wallet.recognition_changes(id,user_id,transaction_id,actor_id,before_data,after_version) VALUES($1,$2,$3,$4,$5,$6)',
            [
              randomUUID(),
              this.db.userId,
              c.transactionId,
              this.db.actorId,
              JSON.stringify({
                counterpartyId: t.counterparty_id,
                categoryId: t.category_id,
                transactionType: t.transaction_type,
                classificationRuleId: t.classification_rule_id,
              }),
              c.version + 1,
            ],
          );
        }
      }
      await this.db.query(
        'UPDATE wallet.recognition_previews SET confirmed_at=clock_timestamp() WHERE id=$1',
        [id],
      );
      return { status: 'confirmed', updated: items.length };
    });
  }
  async changes() {
    return this.db.query(
      'SELECT id,transaction_id AS "transactionId",created_at AS "createdAt",undone_at AS "undoneAt" FROM wallet.recognition_changes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [this.db.userId],
    );
  }
  async undo(id: string, key: string) {
    return this.receipts.execute('recognition.undo', key, { id }, async () => {
      const [change] = await this.db.query(
        'SELECT * FROM wallet.recognition_changes WHERE user_id=$1 AND id=$2 FOR UPDATE',
        [this.db.userId, id],
      );
      if (!change || change.undone_at)
        throw new ConflictException('Esta alteração já foi desfeita ou não está disponível.');
      const [t] = await this.db.query(
        'SELECT * FROM wallet.transactions WHERE user_id=$1 AND id=$2',
        [this.db.userId, change.transaction_id],
      );
      if (!t) throw new NotFoundException();
      await this.accounts.find(t.account_id, true);
      const [locked] = await this.db.query(
        'SELECT * FROM wallet.transactions WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [t.id, this.db.userId],
      );
      if (locked.version !== change.after_version || locked.reversed_at || locked.managed_kind)
        throw new ConflictException('O lançamento foi editado depois. Revise-o em Movimentações.');
      const b = change.before_data;
      await this.db.query(
        'UPDATE wallet.transactions SET counterparty_id=$3,category_id=$4,transaction_type=$5,classification_rule_id=$6,version=version+1 WHERE user_id=$1 AND id=$2',
        [
          this.db.userId,
          t.id,
          b.counterpartyId,
          b.categoryId,
          b.transactionType,
          b.classificationRuleId,
        ],
      );
      await this.db.query(
        'UPDATE wallet.recognition_changes SET undone_at=clock_timestamp() WHERE id=$1',
        [id],
      );
      return { status: 'undone' };
    });
  }
}
