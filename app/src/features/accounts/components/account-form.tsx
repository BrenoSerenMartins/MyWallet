import type { Account } from '../../../shared/api/resources';
import { useState, type FormEvent } from 'react';
import { request, jsonBody } from '../../../shared/api/client';
import { dateToday } from '../../../shared/formatting/money';
import { Button } from '../../../shared/ui/primitives';
export function AccountForm({ onSaved, account }: { onSaved: () => void; account?: Account }) {
  const [name, setName] = useState(account?.name ?? '');
  const [institution, setInstitution] = useState(account?.institution ?? 'mercado_pago');
  const [type, setType] = useState(account?.type ?? 'checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request(account ? `/accounts/${account.id}` : '/accounts', {
        method: account ? 'PATCH' : 'POST',
        headers: account ? { 'If-Match': String(account.version) } : undefined,
        body: jsonBody({
          name,
          institution,
          type,
          openingBalance: account?.openingBalance ?? 0,
          openingDate: account?.openingDate ?? dateToday(),
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <label>
        Nome da conta
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meu Mercado Pago"
        />
      </label>
      <div className="form-grid">
        <label>
          Instituição
          <select
            value={institution}
            onChange={(e) => {
              setInstitution(e.target.value);
              setType(e.target.value === 'alelo' ? 'benefit_food' : 'checking');
            }}
          >
            <option value="alelo">Alelo</option>
            <option value="mercado_pago">Mercado Pago</option>
            <option value="nubank">Nubank</option>
            <option value="itau">Itaú</option>
            <option value="inter">Inter</option>
            <option value="banco_do_brasil">Banco do Brasil</option>
            <option value="other">Outra instituição</option>
          </select>
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {institution === 'alelo' ? (
              <>
                <option value="benefit_food">Vale-alimentação</option>
                <option value="benefit_meal">Vale-refeição</option>
              </>
            ) : (
              <>
                <option value="checking">Conta corrente / pagamento</option>
                <option value="savings">Poupança</option>
                <option value="cash">Dinheiro em espécie</option>
                <option value="reserve">Conta de reserva</option>
              </>
            )}
          </select>
        </label>
      </div>
      <p className="field-help">
        {institution === 'alelo'
          ? 'Benefício não é limite de crédito nem dinheiro livre. A importação validada é para Alimentação. Importe seu histórico e use Corrigir saldo se precisar registrar uma diferença.'
          : 'Importe seu histórico em qualquer ordem ou adicione movimentos manualmente. Se precisar ajustar o valor registrado, use Corrigir saldo na conta.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy || !navigator.onLine}>
        {busy ? 'Salvando…' : account ? 'Salvar alterações' : 'Adicionar conta'}
      </Button>
    </form>
  );
}
