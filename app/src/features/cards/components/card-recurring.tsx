import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../shared/api/client';
import type { components } from '../../../shared/api/generated';
import type { CardsSummary } from '../../../shared/api/resources';
import { useFinanceWrite } from '../../../shared/api/use-finance-write';
import { Button, Modal, ErrorState, Loading } from '../../../shared/ui/primitives';
import { FinanceForm, useFinanceChoices } from '../../../shared/ui/finance-forms';
import { CategorySelect } from '../../../shared/ui/category-select';
import { Select } from '../../../shared/ui/controls/select';
import { MonthPicker } from '../../../shared/ui/controls/month-picker';
import { money, parseMoney, dateToday } from '../../../shared/formatting/money';
type Rule = components['schemas']['CardRecurringResourceDto'];
type Card = CardsSummary['cards'][number];
export function CardRecurring({ card, month }: { card: Card; month: string }) {
  const query = useQuery({
    queryKey: ['card-recurring', card.id],
    queryFn: () => request<Rule[]>(`/cards/${card.id}/recurring`),
  });
  const [edit, setEdit] = useState<Rule | 'new' | null>(null),
    [confirm, setConfirm] = useState<Rule | null>(null);
  return (
    <section className="card-recurring-section">
      <div className="section-heading">
        <h2>Assinaturas e cobranças recorrentes</h2>
        <Button className="secondary" onClick={() => setEdit('new')}>
          Nova assinatura
        </Button>
      </div>
      <p className="field-help">
        Entram na previsão das próximas faturas. Confirme quando a cobrança acontecer ou vincule uma
        compra já registrada.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data.map((r) => (
          <div className="goal-account" key={r.id}>
            <div>
              <strong>
                {r.name} · {money(r.amount)}
              </strong>
              <p className="field-help">
                Dia {r.chargeDay}
                {r.archived
                  ? ' · Pausada'
                  : r.confirmedMonths.includes(month)
                    ? ' · Confirmada neste mês'
                    : ' · Prevista'}
              </p>
            </div>
            <div className="inline-actions">
              <button className="text-button" onClick={() => setEdit(r)}>
                Editar assinatura
              </button>
              {!r.archived &&
                !r.confirmedMonths.includes(month) &&
                month >= r.startMonth &&
                (!r.endMonth || month <= r.endMonth) && (
                  <button className="text-button" onClick={() => setConfirm(r)}>
                    Confirmar cobrança
                  </button>
                )}
            </div>
          </div>
        ))
      )}
      <Modal
        open={edit !== null}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit === 'new' ? 'Nova assinatura' : 'Editar assinatura'}
      >
        {edit && (
          <RecurringForm
            key={edit === 'new' ? 'new' : edit.id}
            card={card}
            rule={edit === 'new' ? undefined : edit}
            onSaved={() => setEdit(null)}
          />
        )}
      </Modal>
      <Modal
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Confirmar cobrança"
      >
        {confirm && (
          <ConfirmForm card={card} rule={confirm} month={month} onSaved={() => setConfirm(null)} />
        )}
      </Modal>
    </section>
  );
}
function RecurringForm({ card, rule, onSaved }: { card: Card; rule?: Rule; onSaved: () => void }) {
  const write = useFinanceWrite(),
    choices = useFinanceChoices();
  const [name, setName] = useState(rule?.name ?? ''),
    [amount, setAmount] = useState(rule ? String(rule.amount / 100).replace('.', ',') : ''),
    [day, setDay] = useState(rule?.chargeDay ?? 1),
    [start, setStart] = useState(rule?.startMonth ?? dateToday().slice(0, 7)),
    [end, setEnd] = useState(rule?.endMonth ?? ''),
    [category, setCategory] = useState(rule?.categoryId ?? ''),
    [archived, setArchived] = useState(rule?.archived ?? false);
  return (
    <FinanceForm
      onSubmit={async () => {
        await write(
          `/cards/${card.id}/recurring${rule ? `/${rule.id}` : ''}`,
          {
            name,
            amount: parseMoney(amount),
            chargeDay: day,
            startMonth: start,
            endMonth: end || null,
            categoryId: category || null,
            archived,
          },
          rule?.version,
          rule ? 'PATCH' : 'POST',
        );
        onSaved();
      }}
    >
      <label>
        Nome
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Valor mensal
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label>
        Dia da cobrança
        <input
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          required
        />
      </label>
      <label>
        Começa em
        <MonthPicker value={start} onChange={(e) => setStart(e.target.value)} required />
      </label>
      <label>
        Termina em (opcional)
        <MonthPicker value={end} onChange={(e) => setEnd(e.target.value)} min={start} />
      </label>
      <label>
        Categoria
        <CategorySelect
          categories={choices.categories.data ?? []}
          value={category}
          type="expense"
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>
      {rule && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Pausar previsões futuras
        </label>
      )}
    </FinanceForm>
  );
}
function ConfirmForm({
  card,
  rule,
  month,
  onSaved,
}: {
  card: Card;
  rule: Rule;
  month: string;
  onSaved: () => void;
}) {
  const write = useFinanceWrite(),
    [purchase, setPurchase] = useState('');
  const candidates = card.purchases.filter(
    (p) =>
      !p.canceled &&
      p.installments === 1 &&
      p.amount === rule.amount &&
      p.purchaseDate.slice(0, 7) === month,
  );
  return (
    <FinanceForm
      label="Confirmar cobrança"
      onSubmit={async () => {
        await write(
          `/cards/${card.id}/recurring/${rule.id}/months/${month}/confirm`,
          { purchaseId: purchase || undefined },
          card.version,
        );
        onSaved();
      }}
    >
      <p>
        {rule.name} · {money(rule.amount)} · {month}
      </p>
      <label>
        Como registrar
        <Select value={purchase} onChange={(e) => setPurchase(e.target.value)}>
          <option value="">Criar a compra deste mês</option>
          {candidates.map((p) => (
            <option value={p.id} key={p.id}>
              Vincular: {p.description} · {p.purchaseDate}
            </option>
          ))}
        </Select>
      </label>
      <p className="field-help">
        Se a compra já existe, selecione-a para evitar duplicação. A previsão é substituída pela
        compra confirmada.
      </p>
    </FinanceForm>
  );
}
