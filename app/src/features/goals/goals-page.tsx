import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { components } from '../../shared/api/generated';
import { request } from '../../shared/api/client';
import { useFinanceWrite } from '../../shared/api/use-finance-write';
import { PageHeader } from '../../shared/ui/page-header';
import { Button, Loading, ErrorState, Modal } from '../../shared/ui/primitives';
import { Select } from '../../shared/ui/controls/select';
import { DatePicker } from '../../shared/ui/controls/date-picker';
import { money, parseMoney } from '../../shared/formatting/money';
import './goals.css';
type Summary = components['schemas']['GoalsSummaryDto'];
type Goal = components['schemas']['GoalResourceDto'];
export function GoalsPage() {
  const query = useQuery({ queryKey: ['goals'], queryFn: () => request<Summary>('/goals') });
  const write = useFinanceWrite();
  const [dialog, setDialog] = useState<'new' | Goal | null>(null),
    [allocation, setAllocation] = useState<Goal | null>(null);
  const [error, setError] = useState('');
  async function undo(g: Goal, event: string) {
    setError('');
    try {
      await write(`/goals/${g.id}/allocations/${event}/undo`, undefined, g.version);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desfazer.');
    }
  }
  return (
    <div className="page-enter goals-page">
      <PageHeader title="Metas e reservas" description="Dê um destino ao dinheiro que você já tem.">
        <Button onClick={() => setDialog('new')}>Nova meta</Button>
      </PageHeader>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="goals-overview">
            <span>Reservado em metas</span>
            <strong>{money(query.data.allocated)}</strong>
            <p>
              Reservar não movimenta contas nem cria despesas. Transferências entre contas continuam
              em Movimentações.
            </p>
          </div>
          <details className="finance-disclosure">
            <summary>Saldo disponível para reservar por conta</summary>
            {query.data.accounts.map((a) => (
              <div className="goal-account" key={a.accountId}>
                <strong>{a.name}</strong>
                <span>
                  {money(a.free)} livre · {money(a.allocated)} reservado
                </span>
                {a.deficit > 0 && (
                  <span className="negative-text">
                    Faltam {money(a.deficit)} para cobrir as reservas desta conta.
                  </span>
                )}
              </div>
            ))}
          </details>
          {!query.data.goals.length && (
            <p className="muted">
              Crie uma meta e escolha quanto do saldo de uma conta quer reservar.
            </p>
          )}
          {query.data.goals.map((g) => (
            <article className="goal-record" key={g.id}>
              <div className="goal-record-head">
                <div>
                  <h2>{g.name}</h2>
                  <p>
                    {g.status === 'completed'
                      ? 'Concluída'
                      : g.status === 'archived'
                        ? 'Arquivada'
                        : g.priority === 1
                          ? 'Prioridade alta'
                          : g.priority === 3
                            ? 'Prioridade baixa'
                            : 'Em andamento'}
                    {g.deadline ? ` · prazo ${g.deadline.split('-').reverse().join('/')}` : ''}
                  </p>
                </div>
                <button className="text-button" onClick={() => setDialog(g)}>
                  Editar meta
                </button>
              </div>
              <div className="goal-metrics">
                <div>
                  <span>Reservado</span>
                  <strong>{money(g.allocated)}</strong>
                </div>
                <div>
                  <span>Objetivo</span>
                  <strong>{money(g.target)}</strong>
                </div>
                <div>
                  <span>Falta reservar</span>
                  <strong>{money(g.remaining)}</strong>
                </div>
              </div>
              <progress max={100} value={g.progress} aria-label={`Progresso de ${g.name}`} />
              {g.monthlyPace != null && g.remaining > 0 && (
                <p className="field-help">
                  Ritmo necessário até o prazo: {money(g.monthlyPace)} por mês.
                </p>
              )}
              {g.underfunded && (
                <p className="negative-text">
                  O saldo de uma conta caiu abaixo do reservado. Revise as alocações; os valores da
                  meta foram preservados.
                </p>
              )}
              {g.status !== 'archived' && (
                <Button className="secondary" onClick={() => setAllocation(g)}>
                  Reservar ou liberar dinheiro
                </Button>
              )}
              <details className="finance-disclosure">
                <summary>Histórico de alocações</summary>
                {!g.allocations.length ? (
                  <p className="field-help">Nenhuma alocação registrada.</p>
                ) : (
                  g.allocations.map((e) => (
                    <div className="goal-event" key={e.id}>
                      <span>
                        {e.delta > 0 ? 'Reservado' : 'Liberado'} ·{' '}
                        {query.data.accounts.find((a) => a.accountId === e.accountId)?.name} ·{' '}
                        {money(Math.abs(e.delta))}
                      </span>
                      <time>{new Date(e.createdAt).toLocaleDateString('pt-BR')}</time>
                      {!e.reverseOfId && !g.allocations.some((r) => r.reverseOfId === e.id) && (
                        <button className="text-button" onClick={() => void undo(g, e.id)}>
                          Desfazer alocação
                        </button>
                      )}
                    </div>
                  ))
                )}
              </details>
            </article>
          ))}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
        title={dialog === 'new' ? 'Nova meta' : 'Editar meta'}
      >
        {dialog && (
          <GoalForm
            goal={dialog === 'new' ? undefined : dialog}
            write={write}
            onSaved={() => setDialog(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!allocation}
        onOpenChange={(v) => {
          if (!v) setAllocation(null);
        }}
        title="Reservar ou liberar dinheiro"
      >
        {allocation && query.data && (
          <AllocationForm
            goal={allocation}
            accounts={query.data.accounts}
            write={write}
            onSaved={() => setAllocation(null)}
          />
        )}
      </Modal>
    </div>
  );
}
function GoalForm({
  goal,
  write,
  onSaved,
}: {
  goal?: Goal;
  write: ReturnType<typeof useFinanceWrite>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? ''),
    [target, setTarget] = useState(goal ? String(goal.target / 100).replace('.', ',') : ''),
    [date, setDate] = useState(goal?.deadline ?? ''),
    [priority, setPriority] = useState(String(goal?.priority ?? 2)),
    [status, setStatus] = useState(goal?.status ?? 'active'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await write(
            goal ? `/goals/${goal.id}` : '/goals',
            {
              name,
              target: parseMoney(target),
              deadline: date || null,
              priority: Number(priority),
              status,
            },
            goal?.version,
            goal ? 'PATCH' : 'POST',
          );
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Nome da meta
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Reserva de emergência"
        />
      </label>
      <label>
        Valor alvo (R$)
        <input
          required
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <label>
        Prazo (opcional)
        <DatePicker value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Prioridade
        <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="1">Alta</option>
          <option value="2">Normal</option>
          <option value="3">Baixa</option>
        </Select>
      </label>
      {goal && (
        <label>
          Situação
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Em andamento</option>
            <option value="completed">Concluída</option>
            <option value="archived">Arquivada</option>
          </Select>
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy}>{busy ? 'Salvando…' : 'Salvar meta'}</Button>
    </form>
  );
}
function AllocationForm({
  goal,
  accounts,
  write,
  onSaved,
}: {
  goal: Goal;
  accounts: Summary['accounts'];
  write: ReturnType<typeof useFinanceWrite>;
  onSaved: () => void;
}) {
  const [account, setAccount] = useState(''),
    [action, setAction] = useState('allocate'),
    [amount, setAmount] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await write(
            `/goals/${goal.id}/allocations`,
            { accountId: account, action, amount: parseMoney(amount) },
            goal.version,
          );
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Não foi possível reservar.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="field-help">
        A alocação apenas destina o saldo existente à meta. Nenhuma movimentação bancária será
        criada.
      </p>
      <label>
        Operação
        <Select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="allocate">Reservar</option>
          <option value="release">Liberar</option>
        </Select>
      </label>
      <label>
        Conta
        <Select required value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="">Selecione a conta</option>
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.name} · livre {money(a.free)}
            </option>
          ))}
        </Select>
      </label>
      <label>
        Valor (R$)
        <input
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy}>{busy ? 'Salvando…' : 'Confirmar alocação'}</Button>
    </form>
  );
}
