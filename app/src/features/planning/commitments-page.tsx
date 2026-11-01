import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Pencil, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../shared/api/client';
import type { Account, CommitmentSchedule, CommitmentOccurrence } from '../../shared/api/resources';
import { dateToday, money, shortDate } from '../../shared/formatting/money';
import { shiftMonth, validMonth } from '../../shared/formatting/month';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { useCommitments } from './hooks/use-commitments';
import { ForecastDetails } from './components/cashflow-forecast';
import { CommitmentForm } from './components/commitment-form';
import { SettleCommitment } from './components/settle-commitment';
import './commitments.css';
const statusLabel = {
  pending: 'A vencer',
  overdue: 'Vencido',
  review: 'Revisar vínculo',
  settled: 'Concluído',
  skipped: 'Dispensado',
};
export function CommitmentsPage() {
  const [params, setParams] = useSearchParams();
  const current = dateToday().slice(0, 7);
  const month = validMonth(params.get('month')) ? params.get('month')! : current;
  const setMonth = (value: string) => {
    if (validMonth(value)) {
      const next = new URLSearchParams(params);
      next.set('month', value);
      setParams(next);
    }
  };
  const { query, write } = useCommitments(month);
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const [filter, setFilter] = useState('pending');
  const [accountFilter, setAccount] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'new' | CommitmentSchedule | null>(null);
  const [selected, setSelected] = useState<CommitmentOccurrence | null>(null);
  const [ending, setEnding] = useState<CommitmentSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const maxMonth = shiftMonth(current, 12);
  const items =
    query.data?.items.filter(
      (r) =>
        (!accountFilter || r.accountId === accountFilter) &&
        r.description.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) &&
        (filter === 'all' ||
          (filter === 'pending' && ['pending', 'overdue', 'review'].includes(r.status)) ||
          (filter === 'done' && ['settled', 'skipped'].includes(r.status))),
    ) ?? [];
  async function end() {
    if (!ending) return;
    setBusy(true);
    setError('');
    try {
      await write(`/${ending.id}/end`, undefined, ending.version);
      setEnding(null);
      setMessage('Série encerrada. Histórico e pendências anteriores a hoje foram preservados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível encerrar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="commitments-page">
      <div className="page-heading">
        <div>
          <h1>Contas e recebimentos</h1>
          <p>Organize vencimentos e acompanhe o que ainda vai acontecer.</p>
        </div>
        <Button onClick={() => setDialog('new')} disabled={!navigator.onLine}>
          <Plus size={18} />
          Novo compromisso
        </Button>
      </div>
      <div className="commitment-period">
        <div className="month-navigation">
          <button
            className="icon-button"
            aria-label="Mês anterior dos compromissos"
            disabled={month === '1900-01'}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <label className="period-picker">
            <span>Mês dos vencimentos</span>
            <input
              aria-label="Mês dos compromissos"
              type="month"
              min="1900-01"
              max={maxMonth}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Próximo mês dos compromissos"
            disabled={month >= maxMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="field-help">
          Pendências vencidas também aparecem, mesmo que sejam de outro mês.
        </p>
      </div>
      {message && (
        <p role="status" className="form-success">
          {message}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="panel cashflow-forecast">
            <ForecastDetails data={query.data} />
          </section>
          <div className="commitment-filters">
            <ViewSwitcher
              label="Situação dos compromissos"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: 'Pendentes' },
                { value: 'done', label: 'Concluídos' },
                { value: 'all', label: 'Todos' },
              ]}
            />
            <label>
              <span className="sr-only">Buscar compromisso</span>
              <input
                type="search"
                placeholder="Buscar compromisso…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">Filtrar conta dos compromissos</span>
              <select value={accountFilter} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Todas as contas</option>
                {accounts.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {query.data.totalItems > 1000 && (
            <p className="field-help">
              Exibindo os primeiros 1.000 vencimentos. A previsão inclui todos os{' '}
              {query.data.totalItems} registros. Revise as pendências mais antigas.
            </p>
          )}
          {!items.length ? (
            <EmptyState
              title={
                query.data.schedules.length
                  ? 'Nenhum vencimento neste filtro'
                  : 'Seus próximos compromissos, organizados'
              }
              action={
                !query.data.schedules.length ? (
                  <Button onClick={() => setDialog('new')}>Adicionar primeiro compromisso</Button>
                ) : undefined
              }
            >
              Cadastre contas fixas, pagamentos avulsos e receitas previstas. Eles só viram
              lançamentos quando você confirmar.
            </EmptyState>
          ) : (
            <ul className="commitment-list">
              {items.map((item) => (
                <li key={`${item.scheduleId}:${item.dueDate}`} className="panel commitment-row">
                  <div
                    className={`commitment-date ${item.status === 'overdue' || item.status === 'review' ? 'expense' : ''}`}
                  >
                    <CalendarClock size={18} />
                    <span>{shortDate(item.dueDate)}</span>
                    <small>{item.dueDate.slice(0, 4)}</small>
                  </div>
                  <div className="commitment-description">
                    <strong>{item.description}</strong>
                    <span>
                      {accounts.data?.find((a) => a.id === item.accountId)?.name ?? 'Conta'} ·{' '}
                      <span className={`commitment-status status-${item.status}`}>
                        {statusLabel[item.status]}
                      </span>
                    </span>
                    {item.status === 'review' && (
                      <small>
                        O lançamento foi desfeito ou alterado. Reabra e confira o vínculo.
                      </small>
                    )}
                  </div>
                  <div className={`commitment-amount ${item.transactionType}`}>
                    <strong>{money(item.actualAmount ?? item.amount)}</strong>
                    <small>
                      {item.actualAmount !== null && item.actualAmount !== item.amount
                        ? `Previsto ${money(item.amount)}`
                        : item.status === 'settled'
                          ? item.transactionType === 'income'
                            ? 'Recebido'
                            : 'Pago'
                          : item.status === 'skipped'
                            ? 'Dispensado'
                            : item.transactionType === 'income'
                              ? 'A receber'
                              : 'A pagar'}
                    </small>
                  </div>
                  <Button
                    className="secondary compact"
                    onClick={() => setSelected(item)}
                    disabled={!navigator.onLine}
                  >
                    {['settled', 'skipped', 'review'].includes(item.status)
                      ? 'Revisar'
                      : item.transactionType === 'income'
                        ? 'Receber'
                        : 'Pagar'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!!query.data.schedules.length && (
            <details className="panel commitment-schedules">
              <summary>Gerenciar compromissos cadastrados · {query.data.schedules.length}</summary>
              <ul>
                {query.data.schedules.map((rule) => (
                  <li key={rule.id}>
                    <div>
                      <strong>{rule.description}</strong>
                      <span>
                        {rule.frequency === 'monthly' ? 'Mensal' : 'Avulso'} · {money(rule.amount)}
                        {rule.endedOn ? ' · Encerrado' : ''}
                      </span>
                    </div>
                    {!rule.endedOn && (
                      <div className="inline-actions">
                        <button
                          className="icon-button"
                          aria-label={`Editar compromisso ${rule.description}`}
                          onClick={() => setDialog(rule)}
                          disabled={!navigator.onLine}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setEnding(rule);
                            setError('');
                          }}
                          disabled={!navigator.onLine}
                        >
                          Encerrar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="field-help">
            Já importou o pagamento? Vincule o lançamento existente ao concluir o vencimento.{' '}
            <Link to="/transactions">Ver movimentações</Link>.
          </p>
        </>
      )}
      <Modal
        open={!!dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === 'new' ? 'Novo compromisso' : 'Editar compromisso'}
        description="Defina o vencimento e o valor previsto."
      >
        {dialog && (
          <CommitmentForm
            schedule={dialog === 'new' ? undefined : dialog}
            onSave={async (data, key) => {
              await write(
                dialog === 'new' ? '' : `/${dialog.id}`,
                data,
                dialog === 'new' ? undefined : dialog.version,
                dialog === 'new' ? 'POST' : 'PATCH',
                key,
              );
              setDialog(null);
              setMessage('Compromisso salvo. A previsão foi atualizada.');
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Concluir ou revisar vencimento"
        description="Vincule um movimento existente ou registre o valor realizado."
      >
        {selected && (
          <SettleCommitment
            item={selected}
            onSave={async (data, key) => {
              await write(
                `/${selected.scheduleId}/occurrences/${selected.dueDate}`,
                data,
                selected.version,
                'POST',
                key,
              );
              setSelected(null);
              setMessage(
                data.action === 'reopen'
                  ? 'Pendência reaberta. O lançamento foi preservado.'
                  : data.action === 'skip'
                    ? 'Vencimento dispensado.'
                    : 'Vencimento concluído. A previsão foi atualizada.',
              );
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!ending}
        onOpenChange={(open) => !open && !busy && setEnding(null)}
        title="Encerrar compromisso"
        description="Confira o que será preservado."
      >
        <p>
          Encerrar <strong>{ending?.description}</strong> remove os vencimentos pendentes de hoje em
          diante. Vencidos anteriores, pagamentos e recebimentos já registrados ficam preservados.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button className="secondary" disabled={busy} onClick={() => setEnding(null)}>
            Voltar
          </Button>
          <Button disabled={busy} onClick={() => void end()}>
            {busy ? 'Encerrando…' : 'Confirmar encerramento'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
