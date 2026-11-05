import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CardsSummary, Account } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { money, shortDate } from '../../../shared/formatting/money';
import { ErrorState, Loading } from '../../../shared/ui/primitives';
/** Optional cash simulation. Bill settlement is never another budget expense. */
export function CardPaymentPlanning({ month }: { month: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const cards = useQuery({
    queryKey: ['cards', month],
    queryFn: () => request<CardsSummary>(`/cards?month=${month}`),
    enabled: open,
  });
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => request<Account[]>('/accounts'),
    enabled: open,
  });
  const bills = (cards.data?.cards ?? []).flatMap((card) =>
    card.bills
      .filter((bill) => bill.month === month && bill.remaining > 0)
      .map((bill) => ({ card, bill, key: card.id + ':' + bill.month })),
  );
  const rows = bills.filter((b) => selected.includes(b.key));
  const accountIds = new Set(rows.map((r) => r.card.paymentAccountId));
  const payingAccounts = accounts.data?.filter((a) => accountIds.has(a.id)) ?? [];
  const total = rows.reduce((n, r) => n + r.bill.remaining, 0);
  return (
    <details
      className="planning-card-payments finance-disclosure"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Planejar pagamentos de cartões</summary>
      <p className="field-help">
        Escolha as faturas para simular a saída na conta de pagamento. A simulação usa os saldos
        atuais, não cria lançamentos e não soma o pagamento outra vez ao orçamento de despesas.
      </p>
      {cards.isError || accounts.isError ? (
        <ErrorState
          error={cards.error ?? accounts.error}
          retry={() => {
            void cards.refetch();
            void accounts.refetch();
          }}
        />
      ) : cards.isPending || accounts.isPending ? (
        <Loading />
      ) : !bills.length ? (
        <p className="muted">
          Nenhuma fatura pendente neste mês. <Link to={`/cards?month=${month}`}>Ver cartões</Link>
        </p>
      ) : (
        <>
          <ul className="card-entry-list">
            {bills.map(({ card, bill, key }) => (
              <li key={key}>
                <label className="finance-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, key]
                          : previous.filter((value) => value !== key),
                      )
                    }
                  />
                  <span>
                    <strong>{card.name}</strong> · vence {shortDate(bill.dueDate)} ·{' '}
                    {money(bill.remaining)}
                    <small>
                      Conta:{' '}
                      {accounts.data?.find((a) => a.id === card.paymentAccountId)?.name ??
                        'Indisponível'}
                    </small>
                  </span>
                </label>
                <Link
                  className="text-button"
                  to={`/cards?card=${card.id}&month=${bill.month}&action=pay`}
                >
                  Registrar ou vincular pagamento
                </Link>
              </li>
            ))}
          </ul>
          {!!rows.length && (
            <div className="finance-review">
              <strong>Pagamentos selecionados: {money(total)}</strong>
              {payingAccounts.map((a) => (
                <p key={a.id}>
                  {a.name}: {money(a.balance)} hoje →{' '}
                  {money(
                    a.balance -
                      rows
                        .filter((r) => r.card.paymentAccountId === a.id)
                        .reduce((n, r) => n + r.bill.remaining, 0),
                  )}{' '}
                  após os pagamentos.
                </p>
              ))}
              {rows.some((r) => !payingAccounts.some((a) => a.id === r.card.paymentAccountId)) && (
                <p role="status">
                  Há faturas sem conta disponível. Revise a conta de pagamento no cartão para
                  simular seu saldo.
                </p>
              )}
              <p className="field-help">
                Não inclui outras entradas ou saídas futuras.{' '}
                {payingAccounts.some((a) => a.type === 'reserve')
                  ? 'Pagamentos por reserva usam o saldo reservado, fora do disponível mensal.'
                  : 'As faturas já entram automaticamente na previsão em Vencimentos; não crie um compromisso duplicado.'}
              </p>
              <Link to={`/planning?view=commitments&month=${month}`}>
                Ver previsão completa em Vencimentos
              </Link>
            </div>
          )}
        </>
      )}
    </details>
  );
}
