import { useState } from 'react';
import { CompactForecast } from './compact-forecast';
import { CommitmentForm } from './commitment-form';
import { Modal } from '../../../shared/ui/primitives';
import { Link } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { dateToday, money, shortDate } from '../../../shared/formatting/money';
import { Loading, ErrorState } from '../../../shared/ui/primitives';
import { useCommitments } from '../hooks/use-commitments';
import type { CommitmentsSummary } from '../../../shared/api/resources';
export function ForecastDetails({
  data,
  visible = true,
}: {
  data: CommitmentsSummary;
  visible?: boolean;
}) {
  const value = (amount: number) => (visible ? money(amount) : '••••••');
  const cash = data.projection.filter((a) => a.kind === 'cash');
  const total = (field: 'balance' | 'income' | 'expense' | 'projected') =>
    cash.reduce((sum, row) => sum + row[field], 0);
  return (
    <>
      <div className="forecast-heading">
        <div>
          <h2>Previsão de saldo</h2>
          <p>Até {shortDate(data.through)} · valores estimados</p>
        </div>
        <CalendarClock size={20} aria-hidden="true" />
      </div>
      {!data.schedules.length && !data.cardBills?.length ? (
        <p className="field-help">
          Adicione contas a pagar e receitas a receber para prever quanto pode sobrar.
        </p>
      ) : (
        <>
          <div className="forecast-totals">
            <div>
              <span>Dinheiro registrado</span>
              <strong>{value(total('balance'))}</strong>
            </div>
            <div>
              <span>A receber</span>
              <strong className="income">{value(total('income'))}</strong>
            </div>
            <div>
              <span>A pagar</span>
              <strong className="expense">{value(total('expense'))}</strong>
            </div>
            <div className="forecast-result">
              <span>Dinheiro previsto</span>
              <strong className={total('projected') < 0 ? 'expense' : ''}>
                {value(total('projected'))}
              </strong>
            </div>
          </div>
          {data.overdueCount > 0 && (
            <p className="forecast-warning">
              Inclui {data.overdueCount} vencimento(s) anterior(es) a hoje ainda pendente(s):{' '}
              {value(data.overdueExpense)} a pagar e {value(data.overdueIncome)} a receber,
              considerando todas as contas. Confirme o que já aconteceu para melhorar a previsão.
            </p>
          )}
          <details className="forecast-accounts">
            <summary>Previsão por conta · benefícios e reservas separados</summary>
            <ul>
              {data.projection.map((a) => (
                <li key={a.accountId}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {a.kind === 'benefits'
                        ? 'Benefício de uso restrito'
                        : a.kind === 'reserves'
                          ? 'Reserva'
                          : 'Dinheiro disponível'}
                    </span>
                  </div>
                  <div>
                    <strong className={a.projected < 0 ? 'expense' : ''}>
                      {value(a.projected)}
                    </strong>
                    <span>
                      Atual {value(a.balance)} · a receber {value(a.income)} · a pagar{' '}
                      {value(a.expense)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          <p className="field-help">
            Saldo registrado + recebimentos pendentes − pagamentos pendentes. Faturas pendentes
            também entram na previsão. Compromissos concluídos e dispensados ficam fora da previsão.
            O orçamento mensal não é somado novamente.
          </p>
        </>
      )}
    </>
  );
}
export function CashflowForecast({
  visible,
  compact = false,
}: {
  visible: boolean;
  compact?: boolean;
}) {
  const month = dateToday().slice(0, 7);
  const { query, write } = useCommitments(month);
  const [adding, setAdding] = useState(false);
  return (
    <section
      className={`panel cashflow-forecast ${compact ? 'forecast-compact' : ''}`}
      aria-label="Previsão de saldo"
    >
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : compact ? (
        <CompactForecast data={query.data} visible={visible} onAdd={() => setAdding(true)} />
      ) : (
        <ForecastDetails data={query.data} visible={visible} />
      )}
      {!compact && (
        <Link className="text-button" to={`/planning?view=commitments&month=${month}`}>
          Ver compromissos <ArrowRight size={16} />
        </Link>
      )}
      <Modal
        open={adding}
        onOpenChange={setAdding}
        title="Novo compromisso"
        description="Defina o vencimento e o valor previsto."
      >
        {adding && (
          <CommitmentForm
            onSave={async (data, key) => {
              await write('', data, undefined, 'POST', key);
              setAdding(false);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
