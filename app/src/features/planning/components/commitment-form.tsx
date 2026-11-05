import { DatePicker } from '../../../shared/ui/controls/date-picker';
import { Select } from '../../../shared/ui/controls/select';
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../shared/api/client';
import type { Account, Category, CommitmentSchedule } from '../../../shared/api/resources';
import type { components } from '../../../shared/api/generated';
import { dateToday, parseMoney } from '../../../shared/formatting/money';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
import { CategorySelect } from '../../../shared/ui/category-select';
export function CommitmentForm({
  schedule,
  onSave,
}: {
  schedule?: CommitmentSchedule;
  onSave: (data: components['schemas']['SaveCommitmentDto'], key: string) => Promise<void>;
}) {
  const [description, setDescription] = useState(schedule?.description ?? '');
  const [type, setType] = useState<'income' | 'expense'>(schedule?.transactionType ?? 'expense');
  const [accountId, setAccount] = useState(schedule?.accountId ?? '');
  const [categoryId, setCategory] = useState(schedule?.categoryId ?? '');
  const [amount, setAmount] = useState(
    schedule ? (schedule.amount / 100).toFixed(2).replace('.', ',') : '',
  );
  const [frequency, setFrequency] = useState<'monthly' | 'once'>(schedule?.frequency ?? 'monthly');
  const [startDate, setStart] = useState(schedule?.startDate ?? dateToday());
  const [endDate, setEnd] = useState(schedule?.endDate ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt] = useState(() => ({ key: crypto.randomUUID(), body: '' }));
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const value = parseMoney(amount);
      if (value <= 0) throw new Error('Informe um valor maior que zero.');
      const data = {
        description,
        accountId,
        categoryId: categoryId || null,
        amount: value,
        transactionType: type,
        frequency,
        startDate,
        endDate: frequency === 'monthly' && endDate ? endDate : null,
      };
      const body = JSON.stringify(data);
      if (receipt.body && receipt.body !== body) receipt.key = crypto.randomUUID();
      receipt.body = body;
      await onSave(data, receipt.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  if (accounts.isPending || categories.isPending) return <Loading />;
  if (accounts.isError || categories.isError)
    return (
      <ErrorState
        error={accounts.error ?? categories.error}
        retry={() => {
          void accounts.refetch();
          void categories.refetch();
        }}
      />
    );
  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Descrição
        <input
          required
          maxLength={120}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Aluguel, salário, internet…"
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo
          <Select
            value={type}
            disabled={!!schedule}
            onChange={(e) => {
              setType(e.target.value as 'income' | 'expense');
              setCategory('');
            }}
          >
            <option value="expense">Conta a pagar</option>
            <option value="income">Receita a receber</option>
          </Select>
        </label>
        <label>
          Conta
          <Select
            required
            value={accountId}
            disabled={!!schedule}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Selecione a conta</option>
            {accounts.data
              .filter((a) => !a.archived || a.id === accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </label>
        <label>
          Valor previsto (R$)
          <input
            required
            inputMode="decimal"
            maxLength={20}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label>
          Categoria
          <CategorySelect
            categories={categories.data}
            type={type}
            value={categoryId}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label>
          Repetição
          <Select
            value={frequency}
            disabled={!!schedule}
            onChange={(e) => setFrequency(e.target.value as 'once' | 'monthly')}
          >
            <option value="monthly">Todo mês</option>
            <option value="once">Uma vez</option>
          </Select>
        </label>
        <label>
          {frequency === 'monthly' ? 'Primeiro vencimento' : 'Vencimento'}
          <DatePicker
            required
            min="1900-01-01"
            max="9998-12-31"
            disabled={!!schedule}
            value={startDate}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        {frequency === 'monthly' && (
          <label>
            Último vencimento (opcional)
            <DatePicker
              min={startDate}
              max="9998-12-31"
              value={endDate}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        )}
      </div>
      <p className="field-help">
        {schedule
          ? 'A edição altera os vencimentos pendentes. Os concluídos mantêm seus dados.'
          : 'O compromisso entra na previsão. O saldo só muda quando houver um lançamento realizado.'}{' '}
        {frequency === 'monthly' && 'Em meses mais curtos, o vencimento cai no último dia.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={busy || !navigator.onLine}>
          {busy ? 'Salvando…' : schedule ? 'Salvar compromisso' : 'Adicionar compromisso'}
        </Button>
      </div>
    </form>
  );
}
