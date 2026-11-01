import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiError, request } from '../../../shared/api/client';
import type { CommitmentOccurrence, CommitmentCandidate } from '../../../shared/api/resources';
import { dateToday, money, parseMoney, shortDate } from '../../../shared/formatting/money';
import { Button, Loading, ErrorState } from '../../../shared/ui/primitives';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import type { components } from '../../../shared/api/generated';
export function SettleCommitment({
  item,
  onSave,
}: {
  item: CommitmentOccurrence;
  onSave: (data: components['schemas']['SettleCommitmentDto'], key: string) => Promise<void>;
}) {
  const resolved = ['settled', 'skipped', 'review'].includes(item.status);
  const [mode, setMode] = useState('link');
  const shift = (offset: number) =>
    new Date(new Date(`${item.dueDate}T12:00:00Z`).getTime() + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const [from, setFrom] = useState(shift(-7));
  const [to, setTo] = useState(shift(7));
  const [transactionId, setTransaction] = useState('');
  const [date, setDate] = useState(dateToday());
  const [amount, setAmount] = useState((item.amount / 100).toFixed(2).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt] = useState(() => ({ key: crypto.randomUUID(), body: '' }));
  const candidates = useQuery({
    queryKey: ['commitment-candidates', item.scheduleId, item.dueDate, from, to],
    queryFn: () =>
      request<CommitmentCandidate[]>(
        `/commitments/${item.scheduleId}/occurrences/${item.dueDate}/candidates?${new URLSearchParams({ from, to })}`,
      ),
    enabled: !resolved && !!from && !!to && from <= to,
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data: components['schemas']['SettleCommitmentDto'] = resolved
        ? { action: 'reopen' }
        : mode === 'link'
          ? {
              action: 'link',
              transactionId,
              transactionVersion: candidates.data?.find((t) => t.id === transactionId)?.version,
            }
          : mode === 'skip'
            ? { action: 'skip' }
            : { action: 'create', transactionDate: date, amount: parseMoney(amount) };
      const body = JSON.stringify(data);
      if (receipt.body && receipt.body !== body) receipt.key = crypto.randomUUID();
      receipt.body = body;
      await onSave(data, receipt.key);
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) void candidates.refetch();
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack commitment-resolution" onSubmit={submit}>
      <p>
        <strong>{item.description}</strong> · {shortDate(item.dueDate)} · previsto{' '}
        {money(item.amount)}
      </p>
      {resolved ? (
        <>
          <p>
            Reabrir retoma a pendência e remove o vínculo. O lançamento financeiro será preservado;
            você poderá vinculá-lo novamente.
          </p>
          {item.transactionId && (
            <Link className="text-button" to={`/transactions?transaction=${item.transactionId}`}>
              Ver lançamento vinculado
            </Link>
          )}
        </>
      ) : (
        <>
          <ViewSwitcher
            label="Como concluir"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'link', label: 'Vincular lançamento' },
              {
                value: 'create',
                label:
                  item.transactionType === 'expense'
                    ? 'Registrar pagamento'
                    : 'Registrar recebimento',
              },
              { value: 'skip', label: 'Dispensar' },
            ]}
          />
          {mode === 'link' && (
            <details className="commitment-candidate-period">
              <summary>Alterar período da busca</summary>
              <div className="form-grid">
                <label>
                  De
                  <input
                    type="date"
                    required
                    value={from}
                    max={to}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setTransaction('');
                    }}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    required
                    value={to}
                    min={from}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setTransaction('');
                    }}
                  />
                </label>
              </div>
              <p className="field-help">
                Busque até 366 dias. Exibimos até 100 lançamentos do período; reduza o intervalo se
                necessário.
              </p>
            </details>
          )}
          {mode === 'link' ? (
            candidates.isPending ? (
              <Loading />
            ) : candidates.isError ? (
              <ErrorState error={candidates.error} retry={() => void candidates.refetch()} />
            ) : (
              <>
                <p className="field-help">
                  Lançamentos da mesma conta e tipo no período escolhido. Vincular não muda o saldo.
                </p>
                {candidates.data.length ? (
                  <label>
                    Lançamento realizado
                    <select
                      required
                      value={transactionId}
                      onChange={(e) => setTransaction(e.target.value)}
                    >
                      <option value="">Escolha o lançamento</option>
                      {candidates.data.map((t) => (
                        <option key={t.id} value={t.id}>
                          {shortDate(t.transactionDate)} · {t.description} ·{' '}
                          {money(Math.abs(t.amount))}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>
                    Nenhum lançamento disponível nesse período. Registre somente se o pagamento ou
                    recebimento ainda não estiver no histórico.
                  </p>
                )}
              </>
            )
          ) : mode === 'create' ? (
            <>
              <p className="field-help">
                Cria um lançamento e atualiza o saldo da conta. Se você já importou esse movimento,
                use Vincular lançamento.
              </p>
              <label>
                Data realizada
                <input
                  required
                  type="date"
                  min="1900-01-01"
                  max={dateToday()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Valor realizado (R$)
                <input
                  required
                  inputMode="decimal"
                  maxLength={20}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            </>
          ) : (
            <p>
              Dispensa apenas este vencimento. Os próximos meses continuam previstos e nenhum
              lançamento será criado.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button
          disabled={busy || !navigator.onLine || (!resolved && mode === 'link' && !transactionId)}
        >
          {busy
            ? 'Confirmando…'
            : resolved
              ? 'Reabrir pendência'
              : mode === 'link'
                ? 'Confirmar vínculo'
                : mode === 'skip'
                  ? 'Dispensar vencimento'
                  : item.transactionType === 'expense'
                    ? 'Confirmar pagamento'
                    : 'Confirmar recebimento'}
        </Button>
      </div>
    </form>
  );
}
