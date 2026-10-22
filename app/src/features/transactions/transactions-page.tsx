import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { request } from '../../shared/api/client';
import type { Account, Category, Collection, Transaction } from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { TransactionRow } from '../../shared/ui/transaction-row';
import { TransactionForm } from './components/transaction-form';
export function TransactionsPage() {
  const { session } = useAuth();
  const { accountId } = useParams();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const [open, setOpen] = useState(params.has('new'));
  const [selected, setSelected] = useState<Transaction>();
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState(accountId ?? '');
  const [kind, setKind] = useState(params.get('type') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    setAccount(accountId ?? '');
  }, [accountId]);
  useEffect(() => {
    if (params.has('new')) {
      setSelected(undefined);
      setOpen(true);
    }
  }, [params]);
  const accounts = useQuery({
    queryKey: [session?.user.id, 'accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const categories = useQuery({
    queryKey: [session?.user.id, 'categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  const query = new URLSearchParams({
    limit: '50',
    ...(account ? { accountId: account } : {}),
    ...(kind ? { type: kind } : {}),
    ...(search ? { search } : {}),
    ...(from ? { from } : {}),
    ...(to
      ? {
          to: new Date(new Date(to + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10),
        }
      : {}),
  });
  const entries = useInfiniteQuery({
    queryKey: [session?.user.id, 'transactions', query.toString()],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      request<Collection<Transaction>>(
        '/transactions?' +
          query.toString() +
          (pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''),
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = entries.data?.pages.flatMap((page) => page.items) ?? [];
  const accountName = accounts.data?.find((a) => a.id === accountId)?.name;
  const close = () => {
    setOpen(false);
    if (params.has('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">O CAMINHO DO SEU DINHEIRO</span>
          <h1>{accountName ?? 'Movimentações'}</h1>
          <p>Um olhar atento para cada entrada, saída e escolha.</p>
        </div>
        <Button
          onClick={() => {
            setSelected(undefined);
            setOpen(true);
          }}
        >
          <Plus size={18} />
          Novo lançamento
        </Button>
      </div>
      <div className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar movimentos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição…"
            />
          </label>
          <label className="filter-select">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Tipo de movimento"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
              <option value="transfer">Transferências</option>
              <option value="unclassified">A revisar</option>
            </select>
          </label>
          <select
            aria-label="Filtrar conta"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Todas as contas</option>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="date-filters">
          <label>
            De
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {entries.isPending ? (
          <Loading />
        ) : entries.isError ? (
          <ErrorState error={entries.error} retry={() => void entries.refetch()} />
        ) : items.length ? (
          <>
            <div className="transaction-list full-list">
              {items.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  onClick={() => {
                    setSelected(t);
                    setOpen(true);
                  }}
                />
              ))}
            </div>
            {entries.hasNextPage && (
              <div className="load-more">
                <Button
                  className="secondary"
                  disabled={entries.isFetchingNextPage}
                  onClick={() => void entries.fetchNextPage()}
                >
                  Carregar mais movimentos
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="Nada por aqui neste período"
            action={
              <Link to="/imports" className="button secondary">
                Importar extrato
              </Link>
            }
          >
            Seus movimentos aparecerão aqui. Você pode importar um extrato ou registrar manualmente.
          </EmptyState>
        )}
      </div>
      <Modal
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : close())}
        title={selected ? 'Detalhes do movimento' : 'Novo lançamento'}
      >
        {accounts.isError ? (
          <ErrorState error={accounts.error} />
        ) : accounts.isPending || categories.isPending ? (
          <Loading />
        ) : (
          <TransactionForm
            key={selected?.id ?? 'new'}
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
            entry={selected}
            onSaved={() => {
              close();
              void client.invalidateQueries();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
