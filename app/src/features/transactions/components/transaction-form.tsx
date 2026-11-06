import { DatePicker } from '../../../shared/ui/controls/date-picker';
import { Select } from '../../../shared/ui/controls/select';
import { CounterpartyFields } from '../../counterparties/components/counterparty-fields';
import { CategorySelect } from '../../../shared/ui/category-select';
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFinanceWrite } from '../../../shared/api/use-finance-write';
import type { CardsSummary } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { MonthPicker } from '../../../shared/ui/controls/month-picker';

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
  const write = useFinanceWrite();
  const cardsQuery = useQuery({
    queryKey: ['cards', 'transaction-picker'],
    queryFn: () => request<CardsSummary>('/cards'),
  });
  const [billMonth, setBillMonth] = useState(
    entry?.transactionDate.slice(0, 7) ?? dateToday().slice(0, 7),
  );
  const [kind, setKind] = useState(entry?.transactionType ?? 'expense');
  const [account, setAccount] = useState(entry?.accountId ?? accounts[0]?.id ?? '');
  const selectedAccount = accounts.find((a) => a.id === account);
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [date, setDate] = useState(entry?.transactionDate ?? dateToday());
  const [value, setValue] = useState(
    entry ? String(Math.abs(entry.amount) / 100).replace('.', ',') : '',
  );
  const [category, setCategory] = useState(entry?.categoryId ?? '');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [agent, setAgent] = useState(entry?.counterpartyId ?? '');
  const [agentName, setAgentName] = useState('');
  const [remember, setRemember] = useState(false);
  const [rememberIdentity, setRememberIdentity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const selectedCard = category.startsWith('card:')
    ? cardsQuery.data?.cards.find((c) => c.id === category.slice(5))
    : undefined;
  const selectedBill = selectedCard?.bills.find((b) => b.month === billMonth);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const parsed = parseMoney(value);
      if (parsed <= 0) throw new Error('Informe um valor maior que zero.');
      if (selectedCard) {
        if (!selectedBill || parsed > selectedBill.remaining)
          throw new Error('Escolha uma fatura com saldo pendente suficiente para este pagamento.');
        await write(
          `/cards/${selectedCard.id}/bills/${billMonth}/transaction-payments`,
          {
            accountId: account,
            amount: parsed,
            date,
            description,
            ...(entry ? { transactionId: entry.id, transactionVersion: entry.version } : {}),
          },
          selectedCard.version,
        );
      } else if (kind === 'transfer')
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
            counterpartyId: agent === 'new' ? null : agent || (entry ? null : undefined),
            counterpartyName: agent === 'new' ? agentName : undefined,
            rememberCategory: remember && !!category && !!agent,
            rememberCounterparty: rememberIdentity && !!agent,
            accountId: account,
            description,
            transactionDate: date,
            amount: kind === 'expense' ? -parsed : parsed,
            transactionType: kind,
            categoryId: !entry && !categoryTouched && !category ? undefined : category || null,
            categoryChoiceExplicit: categoryTouched || entry?.categoryChoiceExplicit,
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
              setCategoryTouched(false);
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
          <Select
            required
            value={account}
            disabled={!!entry}
            onChange={(e) => {
              setAccount(e.target.value);
              if (!entry) {
                setCategory('');
                setCategoryTouched(false);
              }
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Data
          <DatePicker required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {kind === 'transfer' ? (
        <label>
          Conta de destino
          <Select required value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Selecione uma conta</option>
            {accounts
              .filter((a) => a.id !== account)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </label>
      ) : (
        <label>
          Categoria
          <CategorySelect
            categories={categories}
            cardOptions={
              kind === 'expense' ? cardsQuery.data?.cards.filter((c) => !c.archived) : []
            }
            type={kind}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCategoryTouched(true);
            }}
          />
        </label>
      )}
      {!entry &&
        !categoryTouched &&
        !category &&
        (kind === 'income'
          ? selectedAccount?.defaultIncomeCategoryId
          : selectedAccount?.defaultExpenseCategoryId) && (
          <p className="field-help">
            Sem escolha manual, será usada uma regra reconhecida ou a categoria padrão desta conta.
          </p>
        )}
      {selectedCard && (
        <div className="form-stack">
          <label>
            Fatura de vencimento
            <MonthPicker
              required
              clearable={false}
              value={billMonth}
              onChange={(e) => setBillMonth(e.target.value)}
            />
          </label>
          <p className="field-help">
            {selectedBill
              ? `Falta pagar: ${money(selectedBill.remaining)}. O pagamento usa a conta deste lançamento e não cria uma segunda despesa.`
              : 'Nenhuma fatura encontrada neste mês. Escolha o mês da cobrança.'}
          </p>
        </div>
      )}
      {category.startsWith('card:') && cardsQuery.isError && (
        <p role="alert">Não foi possível carregar os cartões. Tente novamente.</p>
      )}
      {!selectedCard && kind !== 'transfer' && !entry?.balanceAdjustment && !entry?.refundOfId && (
        <CounterpartyFields
          accountId={account}
          description={description}
          sourceKind={entry?.sourceKind ?? 'manual'}
          rememberIdentity={rememberIdentity}
          onRememberIdentity={setRememberIdentity}
          agent={agent}
          name={agentName}
          remember={remember}
          category={category}
          automatic={!!entry?.classificationRuleId}
          onAgent={setAgent}
          onName={setAgentName}
          onRemember={setRemember}
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {' '}
        <Button
          disabled={
            busy ||
            !navigator.onLine ||
            (category.startsWith('card:') && (!selectedCard || !selectedBill)) ||
            !!entry?.transferGroupId ||
            !!entry?.balanceAdjustment ||
            !!entry?.refundOfId
          }
        >
          {busy ? 'Salvando…' : entry ? 'Salvar alterações' : 'Registrar movimento'}
        </Button>
      </div>
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
