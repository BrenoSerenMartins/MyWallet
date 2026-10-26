import { useState, type FormEvent } from 'react';
import type { Account } from '../../../shared/api/resources';
import { money, parseMoney } from '../../../shared/formatting/money';
import { request, jsonBody } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/primitives';
export function BalanceAdjustmentForm({
  account,
  onSaved,
}: {
  account: Account;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(String(account.balance / 100).replace('.', ','));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  let target: number | null = null;
  try {
    target = parseMoney(value);
  } catch {
    /* Incomplete input is shown as unavailable until valid. */
  }
  const difference = target === null ? null : target - account.balance;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (target === null || difference === null || !difference || !reason.trim()) return;
    if (
      !window.confirm(
        `Registrar correção de ${money(difference)} para deixar o saldo em ${money(target)}? Seus movimentos existentes serão preservados.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/accounts/${account.id}/balance-adjustments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: jsonBody({ targetBalance: target, expectedBalance: account.balance, reason }),
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
            Será criado um movimento “Correção de saldo manual”. Ele altera o saldo, não entra em
            receitas ou despesas e não marca a conta como conciliada. Seus registros anteriores
            continuam preservados.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Button disabled={busy || !difference || !reason.trim() || !navigator.onLine}>
        {busy ? 'Registrando…' : 'Registrar correção de saldo'}
      </Button>
    </form>
  );
}
