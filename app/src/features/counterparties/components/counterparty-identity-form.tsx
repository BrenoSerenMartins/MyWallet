import { useState } from 'react';
import type { Account } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
export function CounterpartyIdentityForm({
  accounts,
  busy,
  onSave,
}: {
  accounts: Account[];
  busy: boolean;
  onSave: (input: unknown) => Promise<void>;
}) {
  const [accountId, setAccount] = useState('');
  const [sourceKind, setSource] = useState('account_statement');
  const [value, setValue] = useState('');
  return (
    <details className="secondary-disclosure">
      <summary>Adicionar descrição de reconhecimento</summary>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ accountId, sourceKind, value });
        }}
      >
        <label>
          Conta da descrição
          <select required value={accountId} onChange={(event) => setAccount(event.target.value)}>
            <option value="">Selecione a conta</option>
            {accounts
              .filter((account) => !account.archived)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Origem da descrição
          <select value={sourceKind} onChange={(event) => setSource(event.target.value)}>
            <option value="account_statement">Extrato bancário</option>
            <option value="benefit_statement">Extrato de benefício</option>
            <option value="manual">Lançamento manual</option>
          </select>
        </label>
        <label>
          Nova descrição do extrato
          <input
            required
            minLength={3}
            maxLength={500}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Pagamento cartão Maria Oliveira"
          />
        </label>
        <p className="field-help">
          Reconhece esta pessoa ou estabelecimento no histórico e nos próximos movimentos da conta.
          Não exige uma categoria; regras de receita e despesa continuam separadas.
        </p>
        <Button disabled={busy || !accountId || value.trim().length < 3}>
          Vincular descrição e aplicar ao histórico
        </Button>
      </form>
    </details>
  );
}
