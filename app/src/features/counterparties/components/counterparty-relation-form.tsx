import { useState } from 'react';
import type { Account, Category } from '../../../shared/api/resources';
import { CategorySelect } from '../../../shared/ui/category-select';
import { Button } from '../../../shared/ui/primitives';
export function CounterpartyRelationForm({
  accounts,
  categories,
  busy,
  onSave,
}: {
  accounts: Account[];
  categories: Category[];
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [accountId, setAccount] = useState(accounts[0]?.id ?? '');
  const [sourceKind, setSource] = useState('account_statement');
  const [identifierKind, setIdentifierKind] = useState('description');
  const [transactionType, setType] = useState<'income' | 'expense'>('expense');
  const [value, setValue] = useState('');
  const [categoryId, setCategory] = useState('');
  return (
    <details className="secondary-disclosure">
      <summary>Relacionar uma origem e aplicar ao histórico</summary>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            accountId,
            sourceKind,
            identifierKind,
            transactionType,
            value,
            categoryId,
          });
        }}
      >
        <div className="form-grid">
          <label>
            Conta da relação
            <select required value={accountId} onChange={(e) => setAccount(e.target.value)}>
              <option value="">Selecione</option>
              {accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Origem da identificação
            <select
              disabled={identifierKind === 'store_id'}
              value={sourceKind}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="account_statement">Extrato bancário</option>
              <option value="settlement">EDI Mercado Pago</option>
              <option value="benefit_statement">Extrato de benefício</option>
              <option value="manual">Lançamento manual</option>
            </select>
          </label>
        </div>
        <label>
          Tipo de identificação
          <select
            value={identifierKind}
            onChange={(e) => {
              setIdentifierKind(e.target.value);
              if (e.target.value === 'store_id') setSource('settlement');
            }}
          >
            <option value="description">Nome ou descrição na origem</option>
            <option value="store_id">ID da loja (STORE_ID)</option>
          </select>
        </label>
        <label>
          {identifierKind === 'store_id'
            ? 'ID da loja (STORE_ID)'
            : 'Descrição como aparece na origem'}
          <input
            required
            minLength={identifierKind === 'store_id' ? 1 : 3}
            maxLength={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              identifierKind === 'store_id'
                ? 'Identificador da loja, não o SOURCE_ID da operação'
                : 'Pix enviado Supermercado ABC'
            }
          />
        </label>
        <div className="form-grid">
          <label>
            Tipo da regra
            <select
              value={transactionType}
              onChange={(e) => {
                setType(e.target.value as 'income' | 'expense');
                setCategory('');
              }}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </label>
          <label>
            Categoria da relação
            <CategorySelect
              categories={categories}
              type={transactionType}
              value={categoryId}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
        </div>
        <p className="field-help">
          Aplica a lançamentos anteriores reconhecidos que estejam sem categoria ou classificados
          por uma regra. Escolhas manuais, valores e conciliação serão preservados. Essa categoria
          passa a valer para este agente, nesta conta e neste tipo de movimento.
        </p>
        <Button disabled={busy || !accountId || !categoryId || !value.trim()}>
          Relacionar e aplicar ao histórico
        </Button>
      </form>
    </details>
  );
}
