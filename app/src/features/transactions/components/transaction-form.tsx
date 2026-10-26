import { CategorySelect } from '../../../shared/ui/category-select';
import { useState, type FormEvent } from 'react';
import type { Account, Category, Transaction } from '../../../shared/api/resources';
import { jsonBody, request } from '../../../shared/api/client';
import { dateToday, parseMoney } from '../../../shared/formatting/money';
import { Button } from '../../../shared/ui/primitives';
export function TransactionForm({
  accounts,
  categories,
  entry,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  entry?: Transaction;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState(entry?.transactionType ?? 'expense');
  const [account, setAccount] = useState(entry?.accountId ?? accounts[0]?.id ?? '');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [date, setDate] = useState(entry?.transactionDate ?? dateToday());
  const [value, setValue] = useState(
    entry ? String(Math.abs(entry.amount) / 100).replace('.', ',') : '',
  );
  const [category, setCategory] = useState(entry?.categoryId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const parsed = parseMoney(value);
      if (parsed <= 0) throw new Error('Informe um valor maior que zero.');
      if (kind === 'transfer')
        await request('/transfers', {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: jsonBody({
            fromAccountId: account,
            toAccountId: destination,
            amount: parsed,
            transactionDate: date,
            description,
          }),
        });
      else
        await request(entry ? `/transactions/${entry.id}` : '/transactions', {
          method: entry ? 'PATCH' : 'POST',
          headers: entry ? { 'If-Match': String(entry.version) } : undefined,
          body: jsonBody({
            accountId: account,
            description,
            transactionDate: date,
            amount: kind === 'expense' ? -parsed : parsed,
            transactionType: kind,
            categoryId: category || null,
          }),
        });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  async function reverse() {
    if (
      !entry ||
      !window.confirm(
        'Desfazer este lançamento? Se for uma transferência, os dois lados serão desfeitos.',
      )
    )
      return;
    setBusy(true);
    try {
      await request(`/transactions/${entry.id}/reversals`, {
        method: 'POST',
        headers: { 'If-Match': String(entry.version) },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desfazer.');
    } finally {
      setBusy(false);
    }
  }
  if (!accounts.length)
    return <p className="field-help">Crie uma conta antes de registrar seu primeiro lançamento.</p>;
  return (
    <form className="form-stack" onSubmit={save}>
      <div className="segmented" aria-label="Tipo de movimento">
        {(['expense', 'income', ...(!entry ? ['transfer'] : [])] as const).map((type) => (
          <button
            type="button"
            key={type}
            className={kind === type ? 'selected' : ''}
            onClick={() => {
              setKind(type as typeof kind);
              setCategory('');
            }}
          >
            {type === 'expense' ? 'Despesa' : type === 'income' ? 'Receita' : 'Transferência'}
          </button>
        ))}
      </div>
      <label>
        Valor (R$)
        <input
          className="amount-input"
          required
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0,00"
        />
      </label>
      <label>
        Descrição
        <input
          required
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que foi esse movimento?"
        />
      </label>
      <div className="form-grid">
        <label>
          {kind === 'transfer' ? 'Conta de origem' : 'Conta'}
          <select
            required
            value={account}
            disabled={!!entry}
            onChange={(e) => setAccount(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data
          <input
            required
            type="date"
            value={date}
            min={accounts.find((a) => a.id === account)?.openingDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {kind === 'transfer' ? (
        <label>
          Conta de destino
          <select required value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Selecione uma conta</option>
            {accounts
              .filter((a) => a.id !== account)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
      ) : (
        <label>
          Categoria
          <CategorySelect
            categories={categories}
            type={kind}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button
        disabled={
          busy ||
          !navigator.onLine ||
          !!entry?.transferGroupId ||
          !!entry?.balanceAdjustment ||
          !!entry?.refundOfId
        }
      >
        {busy ? 'Salvando…' : entry ? 'Salvar alterações' : 'Registrar movimento'}
      </Button>
      {entry && (
        <button
          type="button"
          className="text-button danger"
          disabled={busy}
          onClick={() => void reverse()}
        >
          Desfazer lançamento{entry.transferGroupId ? ' e sua contraparte' : ''}
        </button>
      )}
    </form>
  );
}
