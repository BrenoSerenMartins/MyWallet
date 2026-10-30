import { useState, type FormEvent } from 'react';
import type { Account } from '../../../shared/api/resources';
import { money, parseMoney } from '../../../shared/formatting/money';
import { request, jsonBody } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/primitives';
export function BalanceAdjustmentForm({
  account,
  onSaved,
  initial = false,
}: {
  account: Account;
  onSaved: () => void;
  initial?: boolean;
}) {
  const [value, setValue] = useState(String(account.balance / 100).replace('.', ','));
  const [reason, setReason] = useState(
    initial ? 'Saldo atual conferido após importar o histórico' : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  let target: number | null = null;
  try {
    target = parseMoney(value);
  } catch {
    /* Incomplete input is shown as unavailable until valid. */
  }
  const mayConfirmZero =
    account.balanceBasis?.kind === 'unknown' || !!account.balanceBasis?.reviewRequired;
  const difference = target === null ? null : target - account.balance;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (
      target === null ||
      difference === null ||
      (!difference && !mayConfirmZero) ||
      !reason.trim()
    )
      return;
    if (
      !window.confirm(
        `Confirmar saldo atual de ${money(target)}? O saldo base será recalculado e seus movimentos existentes serão preservados.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/accounts/${account.id}/balance-adjustments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: jsonBody({
          targetBalance: target,
          expectedBalance: account.balance,
          expectedVersion: account.version,
          reason,
        }),
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível corrigir o saldo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <p>
        {account.name} · saldo registrado: <strong>{money(account.balance)}</strong>
      </p>
      <label>
        Saldo atual correto (R$)
        <input
          required
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <label>
        Motivo da correção
        <textarea
          required
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ex.: diferença de histórico anterior ao acompanhamento"
        />
      </label>
      <div className="review-banner">
        <div>
          <strong>
            Diferença a registrar:{' '}
            {difference === null ? 'Informe um valor válido' : money(difference)}
          </strong>
          <p>
            O saldo base será ajustado, com data e motivo no histórico de correções. Nenhum
            lançamento financeiro será criado. Receitas, despesas e movimentos existentes serão
            preservados.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Button
        disabled={busy || (!difference && !mayConfirmZero) || !reason.trim() || !navigator.onLine}
      >
        {busy ? 'Registrando…' : initial ? 'Confirmar saldo atual' : 'Registrar correção de saldo'}
      </Button>
    </form>
  );
}
