import { FinanceAreaNav } from '../../shared/navigation/finance-area-nav';
import { PageHeader } from '../../shared/ui/page-header';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard as CreditIcon,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { request } from '../../shared/api/client';
import { useFinanceWrite } from '../../shared/api/use-finance-write';
import type {
  CardsSummary,
  CardEntry,
  CardPayment,
  CardPurchase,
} from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import {
  FinanceForm,
  useFinanceChoices,
  FinanceChoices,
  moneyInput,
} from '../../shared/ui/finance-forms';
import { CategorySelect } from '../../shared/ui/category-select';
import { dateToday, money, parseMoney, shortDate } from '../../shared/formatting/money';
import { validMonth, shiftMonth } from '../../shared/formatting/month';
import { CardForm, CardPurchaseForm, CardOpeningForm } from './components/card-forms';
import { CardPaymentForm } from './components/card-payment-form';
import './cards.css';
type Dialog =
  | { kind: 'new' | 'edit' | 'purchase' | 'opening' | 'pay' }
  | { kind: 'refund' | 'undoRefund' | 'undoOpening'; entry: CardEntry }
  | { kind: 'undoPayment'; payment: CardPayment }
  | { kind: 'category' | 'cancelPurchase'; purchase: CardPurchase };
const states = { open: 'Em aberto', closed: 'Fechada', overdue: 'Vencida', paid: 'Sem pendência' };
export function CardsPage() {
  const [params, setParams] = useSearchParams();
  const month = validMonth(params.get('month')) ? params.get('month')! : dateToday().slice(0, 7);
  const query = useQuery({
    queryKey: ['cards', month],
    queryFn: () => request<CardsSummary>(`/cards?month=${month}`),
  });
  const write = useFinanceWrite();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [visible, setVisible] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState('');
  const value = (n: number) => (visible ? money(n) : '••••••');
  const all = query.data?.cards ?? [];
  const cards = all.filter((c) => showArchived || !c.archived);
  const card = cards.find((c) => c.id === params.get('card')) ?? cards[0];
  const bill = card?.bills.find((b) => b.month === month);
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, val] of Object.entries(changes)) next.set(key, val);
    setParams(next);
  };
  const saved = (newMonth?: string) => {
    setDialog(null);
    setMessage('Registro salvo. Faturas, relatórios e previsão foram atualizados.');
    if (newMonth) update({ month: newMonth });
  };
  return (
    <div className="page-enter cards-page">
      <FinanceAreaNav />
      <PageHeader
        title={<>Cartões e faturas</>}
        description={<>Compras organizadas, sem contar o pagamento duas vezes.</>}
      >
        <div className="inline-actions">
          <button
            className="icon-button"
            aria-label={visible ? 'Ocultar valores dos cartões' : 'Mostrar valores dos cartões'}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <Button onClick={() => setDialog({ kind: 'new' })} disabled={!navigator.onLine}>
            <Plus size={18} />
            Novo cartão
          </Button>
        </div>
      </PageHeader>
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <label className="finance-checkbox">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Mostrar cartões arquivados
          </label>
          {!cards.length ? (
            <EmptyState
              title="Seu crédito, com clareza"
              action={
                <Button onClick={() => setDialog({ kind: 'new' })}>
                  Adicionar primeiro cartão
                </Button>
              }
            >
              Cadastre o fechamento e o vencimento para organizar compras e parcelas.
            </EmptyState>
          ) : (
            <div className="cards-workspace">
              <div className="credit-selector" role="group" aria-label="Escolher cartão">
                {cards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`panel credit-selector-item ${c.id === card?.id ? 'selected' : ''}`}
                    aria-pressed={c.id === card?.id}
                    onClick={() => update({ card: c.id })}
                  >
                    <span>
                      <CreditIcon size={20} />
                      <strong>{c.name}</strong>
                      {c.archived && <small>Arquivado</small>}
                    </span>
                    <span>
                      Dívida total<strong>{value(c.debt)}</strong>
                    </span>
                    {c.limit > 0 ? (
                      <>
                        <span className="credit-limit">
                          <span
                            style={{
                              width: visible ? `${Math.min(100, (c.debt / c.limit) * 100)}%` : '0%',
                            }}
                          />
                        </span>
                        <small>
                          Disponível {value(c.availableLimit)} de {value(c.limit)}
                        </small>
                      </>
                    ) : (
                      <small>Limite não informado</small>
                    )}
                    {c.credit > 0 && <small>Crédito no cartão {value(c.credit)}</small>}
                  </button>
                ))}
              </div>
              {card && (
                <section className="panel card-detail">
                  <div className="section-heading">
                    <div>
                      <h2>{card.name}</h2>
                      <p>
                        Fecha dia {card.closingDay} · vence dia {card.dueDay}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Editar cartão"
                      onClick={() => setDialog({ kind: 'edit' })}
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                  <div className="card-bill-toolbar">
                    <div className="finance-month-navigation">
                      <button
                        className="icon-button"
                        aria-label="Fatura anterior"
                        disabled={month === '1900-01'}
                        onClick={() => update({ month: shiftMonth(month, -1) })}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <label className="period-picker">
                        <span>Mês de vencimento</span>
                        <input
                          aria-label="Mês da fatura"
                          type="month"
                          min="1900-01"
                          max="9998-12"
                          value={month}
                          onChange={(e) => e.target.value && update({ month: e.target.value })}
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label="Próxima fatura"
                        disabled={month === '9998-12'}
                        onClick={() => update({ month: shiftMonth(month, 1) })}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <div className="inline-actions">
                      <Button
                        className="secondary compact"
                        disabled={card.archived || !navigator.onLine}
                        onClick={() => setDialog({ kind: 'purchase' })}
                      >
                        Registrar compra
                      </Button>
                      {!card.bills.some((b) =>
                        b.entries.some((e) => e.kind === 'opening' && e.active),
                      ) && (
                        <button
                          className="text-button"
                          disabled={card.archived || !navigator.onLine}
                          onClick={() => setDialog({ kind: 'opening' })}
                        >
                          Dívida anterior
                        </button>
                      )}
                    </div>
                  </div>
                  {bill ? (
                    <>
                      <div className="card-bill-stats">
                        <div>
                          <span>Total da fatura</span>
                          <strong>{value(bill.total)}</strong>
                        </div>
                        <div>
                          <span>Pagamentos</span>
                          <strong>{value(bill.paid)}</strong>
                        </div>
                        <div>
                          <span>Créditos aplicados</span>
                          <strong>{value(bill.creditApplied)}</strong>
                        </div>
                        <div>
                          <span>A pagar</span>
                          <strong className={bill.remaining > 0 ? 'negative' : ''}>
                            {value(bill.remaining)}
                          </strong>
                        </div>
                      </div>
                      <div className="card-bill-status">
                        <span className={`bill-state state-${bill.state}`}>
                          {states[bill.state]}
                        </span>
                        <span>
                          Fechamento {shortDate(bill.closingDate)} · vencimento{' '}
                          {shortDate(bill.dueDate)}
                        </span>
                        {bill.remaining > 0 && (
                          <Button
                            className="compact"
                            disabled={!navigator.onLine}
                            onClick={() => setDialog({ kind: 'pay' })}
                          >
                            Pagar ou vincular
                          </Button>
                        )}
                      </div>
                      <ul className="card-entry-list">
                        {bill.entries.map((entry) => (
                          <li key={entry.id} className={!entry.active ? 'inactive' : ''}>
                            <div>
                              <strong>{entry.description}</strong>
                              <span>
                                {!entry.active
                                  ? 'Desfeito'
                                  : entry.kind === 'opening'
                                    ? 'Dívida anterior'
                                    : entry.kind === 'refund'
                                      ? 'Estorno'
                                      : 'Despesa da fatura'}
                              </span>
                            </div>
                            <strong className={entry.amount > 0 ? 'positive' : ''}>
                              {value(Math.abs(entry.amount))}
                              {entry.amount > 0 ? ' de crédito' : ''}
                            </strong>
                            {entry.active && entry.kind === 'purchase' && (
                              <button
                                className="text-button"
                                onClick={() => setDialog({ kind: 'refund', entry })}
                              >
                                Estornar
                              </button>
                            )}
                            {entry.active && entry.kind === 'refund' && (
                              <button
                                className="text-button"
                                onClick={() => setDialog({ kind: 'undoRefund', entry })}
                              >
                                Desfazer estorno
                              </button>
                            )}
                            {entry.active && entry.kind === 'opening' && (
                              <button
                                className="text-button"
                                onClick={() => setDialog({ kind: 'undoOpening', entry })}
                              >
                                Corrigir dívida anterior
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {!!bill.payments.length && (
                        <details className="finance-disclosure">
                          <summary>Pagamentos e vínculos · {bill.payments.length}</summary>
                          <ul className="card-entry-list">
                            {bill.payments.map((p) => (
                              <li key={p.id}>
                                <div>
                                  <strong>
                                    {p.mode === 'link'
                                      ? 'Vinculado ao extrato'
                                      : 'Pagamento registrado'}
                                  </strong>
                                  <span>
                                    {shortDate(p.paymentDate)} ·{' '}
                                    {p.voided
                                      ? 'Desfeito'
                                      : p.active
                                        ? 'Ativo'
                                        : 'Revisão necessária'}
                                  </span>
                                </div>
                                <strong>{value(p.amount)}</strong>
                                {!p.voided && (
                                  <button
                                    className="text-button"
                                    onClick={() => setDialog({ kind: 'undoPayment', payment: p })}
                                  >
                                    {p.mode === 'link' ? 'Desvincular' : 'Desfazer registro'}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  ) : (
                    <EmptyState title="Nenhuma compra nesta fatura">
                      As parcelas aparecerão aqui conforme o mês de vencimento.
                    </EmptyState>
                  )}
                  <p className="field-help">
                    Os pagamentos entram na previsão de saldo automaticamente. Não cadastre um
                    compromisso recorrente para a mesma fatura. Créditos excedentes abatem as
                    faturas mais antigas; confira o valor informado pelo emissor. Encargos devem ser
                    registrados conforme o banco.
                  </p>
                  {!!card.purchases.length && (
                    <details className="finance-disclosure">
                      <summary>Compras e parcelamentos · {card.purchases.length}</summary>
                      <ul className="card-entry-list">
                        {card.purchases.map((p) => (
                          <li key={p.id}>
                            <div>
                              <strong>{p.description}</strong>
                              <span>
                                {shortDate(p.purchaseDate)} · {p.installments} parcela(s)
                                {p.canceled ? ' · Cancelada' : ''}
                              </span>
                            </div>
                            <strong>{value(p.amount)}</strong>
                            {!p.canceled && (
                              <div className="inline-actions">
                                <button
                                  className="text-button"
                                  onClick={() => setDialog({ kind: 'category', purchase: p })}
                                >
                                  Categoria
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => setDialog({ kind: 'cancelPurchase', purchase: p })}
                                >
                                  Cancelar compra
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              )}
            </div>
          )}
          <Link className="text-button" to="/wealth">
            Ver impacto no patrimônio
          </Link>
        </>
      )}
      <Modal
        open={!!dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        title={
          dialog?.kind === 'new'
            ? 'Novo cartão'
            : dialog?.kind === 'edit'
              ? 'Editar cartão'
              : dialog?.kind === 'purchase'
                ? 'Compra no cartão'
                : dialog?.kind === 'pay'
                  ? 'Pagamento da fatura'
                  : dialog?.kind === 'opening'
                    ? 'Dívida anterior'
                    : dialog?.kind === 'refund'
                      ? 'Estorno no cartão'
                      : dialog?.kind === 'category'
                        ? 'Categoria da compra'
                        : 'Revisar correção'
        }
        description="Confira os valores antes de confirmar."
      >
        {dialog?.kind === 'new' && <CardForm write={write} onSaved={() => saved()} />}
        {dialog?.kind === 'edit' && card && (
          <CardForm card={card} write={write} onSaved={() => saved()} />
        )}
        {dialog?.kind === 'purchase' && card && (
          <CardPurchaseForm card={card} write={write} onSaved={saved} />
        )}
        {dialog?.kind === 'opening' && card && (
          <CardOpeningForm card={card} month={month} write={write} onSaved={() => saved()} />
        )}
        {dialog?.kind === 'pay' && card && bill && (
          <CardPaymentForm card={card} bill={bill} write={write} onSaved={() => saved()} />
        )}
        {dialog?.kind === 'category' && card && (
          <PurchaseCategory
            cardId={card.id}
            version={card.version}
            purchase={dialog.purchase}
            write={write}
            onSaved={() => saved()}
          />
        )}
        {dialog?.kind === 'refund' && card && (
          <RefundForm
            cardId={card.id}
            version={card.version}
            entry={dialog.entry}
            month={month}
            write={write}
            onSaved={() => saved()}
          />
        )}
        {card &&
          dialog &&
          ['cancelPurchase', 'undoPayment', 'undoRefund', 'undoOpening'].includes(dialog.kind) && (
            <FinanceForm
              label="Confirmar correção"
              onSubmit={async () => {
                if (dialog.kind === 'cancelPurchase')
                  await write(
                    `/cards/${card.id}/purchases/${dialog.purchase.id}/reversal`,
                    undefined,
                    card.version,
                  );
                if (dialog.kind === 'undoPayment')
                  await write(
                    `/cards/${card.id}/payments/${dialog.payment.id}/reversal`,
                    undefined,
                    card.version,
                  );
                if (dialog.kind === 'undoRefund')
                  await write(
                    `/cards/${card.id}/refunds/${dialog.entry.id}/reversal`,
                    undefined,
                    card.version,
                  );
                if (dialog.kind === 'undoOpening')
                  await write(
                    `/cards/${card.id}/opening/${dialog.entry.id}/reversal`,
                    undefined,
                    card.version,
                  );
                saved();
              }}
            >
              <p>
                {dialog.kind === 'undoPayment'
                  ? dialog.payment.mode === 'link'
                    ? 'A saída do extrato será preservada como transferência sem vínculo, e a fatura será reaberta. Vincule a saída à fatura correta em seguida.'
                    : 'Desfaz as duas pontas do pagamento registrado, devolvendo o valor ao saldo da conta e reabrindo a fatura.'
                  : dialog.kind === 'cancelPurchase'
                    ? 'Cancela as parcelas desta compra, preservando o histórico da correção. Compras com pagamentos ou estornos devem ser revisadas antes.'
                    : dialog.kind === 'undoOpening'
                      ? 'Remove a dívida anterior registrada incorretamente. Se houver pagamentos, revise os vínculos antes de corrigir a dívida.'
                      : 'Desfaz o crédito deste estorno, restaurando o valor pendente nas faturas.'}
              </p>
            </FinanceForm>
          )}
      </Modal>
    </div>
  );
}
function PurchaseCategory({
  cardId,
  version,
  purchase,
  write,
  onSaved,
}: {
  cardId: string;
  version: number;
  purchase: CardPurchase;
  write: ReturnType<typeof useFinanceWrite>;
  onSaved: () => void;
}) {
  const choices = useFinanceChoices();
  const [category, setCategory] = useState(purchase.categoryId ?? '');
  return (
    <FinanceChoices accounts={choices.accounts} categories={choices.categories}>
      <FinanceForm
        label="Salvar categoria"
        onSubmit={async () => {
          await write(
            `/cards/${cardId}/purchases/${purchase.id}/category`,
            { categoryId: category || null },
            version,
            'PATCH',
          );
          onSaved();
        }}
      >
        <p>
          Altera a categoria de todas as parcelas e dos estornos vinculados, sem mudar valores ou
          pagamentos.
        </p>
        <label>
          Categoria
          <CategorySelect
            categories={choices.categories.data ?? []}
            type="expense"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
      </FinanceForm>
    </FinanceChoices>
  );
}
function RefundForm({
  cardId,
  version,
  entry,
  month,
  write,
  onSaved,
}: {
  cardId: string;
  version: number;
  entry: CardEntry;
  month: string;
  write: ReturnType<typeof useFinanceWrite>;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(moneyInput(Math.abs(entry.amount)));
  const [billMonth, setMonth] = useState(month);
  return (
    <FinanceForm
      label="Registrar estorno"
      onSubmit={async () => {
        await write(
          `/cards/${cardId}/refunds`,
          { entryId: entry.id, billMonth, amount: parseMoney(amount) },
          version,
        );
        onSaved();
      }}
    >
      <p>{entry.description}</p>
      <label>
        Crédito do estorno (R$)
        <input
          required
          inputMode="decimal"
          maxLength={20}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label>
        Fatura que recebeu o crédito
        <input
          required
          type="month"
          min={entry.billMonth}
          max="9998-12"
          value={billMonth}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <p className="field-help">
        Informe o crédito desta parcela. Estornos já registrados contam no limite devolvido. A
        categoria original será preservada e a despesa reduzida.
      </p>
    </FinanceForm>
  );
}
