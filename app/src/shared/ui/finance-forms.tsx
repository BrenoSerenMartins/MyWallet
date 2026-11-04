import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '../api/client';
import type { Account, Category } from '../api/resources';
import { Button, ErrorState, Loading } from './primitives';
export function useFinanceChoices() {
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  return { accounts, categories };
}
export function FinanceForm({
  children,
  onSubmit,
  label = 'Salvar',
  disabled = false,
}: {
  children: ReactNode;
  onSubmit: () => Promise<void>;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <fieldset className="finance-fields" disabled={busy}>
        {children}
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={busy || disabled || !navigator.onLine}>
          {busy ? 'Salvando…' : label}
        </Button>
      </div>
    </form>
  );
}
export function FinanceChoices({
  accounts,
  categories,
  children,
}: {
  accounts: ReturnType<typeof useFinanceChoices>['accounts'];
  categories?: ReturnType<typeof useFinanceChoices>['categories'];
  children: ReactNode;
}) {
  if (accounts.isPending || categories?.isPending) return <Loading />;
  if (accounts.isError || categories?.isError)
    return (
      <ErrorState
        error={accounts.error ?? categories?.error}
        retry={() => {
          void accounts.refetch();
          void categories?.refetch();
        }}
      />
    );
  return children;
}
export const moneyInput = (amount: number) => (amount / 100).toFixed(2).replace('.', ',');
