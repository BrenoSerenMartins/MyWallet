import { money } from '../../shared/formatting/money';
import { TransactionSources } from './components/transaction-sources';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { CategorySelect } from '../../shared/ui/category-select';
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
  const [category, setCategory] = useState('');
  const [reconciliation, setReconciliation] = useState('');
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
  const transactionId = params.get('transaction');
  const requestedTransaction = useQuery({
    queryKey: [session?.user.id, 'transaction', transactionId],
    enabled: !!transactionId,
    queryFn: () => request<Transaction>(`/transactions/${transactionId}`),
  });
  useEffect(() => {
    if (requestedTransaction.data && transactionId) {
      setSelected(requestedTransaction.data);
      setOpen(true);
    }
  }, [requestedTransaction.data, transactionId]);
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
    ...(category ? { categoryId: category } : {}),
    ...(reconciliation ? { reconciliation } : {}),
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
    if (params.has('new') || params.has('transaction')) {
      params.delete('new');
      params.delete('transaction');
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
      {requestedTransaction.isError && <ErrorState error={requestedTransaction.error} />}
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
        </div>
        <ViewSwitcher
          label="Tipos de movimentos"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setCategory('');
          }}
          options={[
            { value: '', label: 'Todos' },
            { value: 'expense', label: 'Despesas' },
            { value: 'income', label: 'Receitas' },
            { value: 'transfer', label: 'Transferências' },
            { value: 'unclassified', label: 'A revisar' },
          ]}
        />
        <details className="filter-disclosure">
          <summary>
            <SlidersHorizontal size={17} />
            Filtros de conta, categoria e período
            {(account || category || from || to || reconciliation) && (
              <span className="badge">Ativos</span>
            )}
          </summary>
          <div className="expanded-filters">
            <label>
              Conciliação
              <select
                aria-label="Filtrar conciliação"
                value={reconciliation}
                onChange={(event) => setReconciliation(event.target.value)}
              >
                <option value="">Todas</option>
                <option value="pending">Pendentes</option>
                <option value="reconciled">Conferidas por arquivo</option>
              </select>
            </label>
            <label>
              Conta
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
            </label>
            <label>
              Categoria
              <CategorySelect
                aria-label="Filtrar categoria"
                emptyLabel="Todas as categorias"
                categories={categories.data ?? []}
                type={kind || undefined}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label>
              De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button
              className="text-button"
              onClick={() => {
                setAccount(accountId ?? '');
                setCategory('');
                setReconciliation('');
                setFrom('');
                setTo('');
              }}
            >
              Limpar filtros
            </button>
          </div>
        </details>
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
                  categoryLabel={
                    categories.data
                      ?.filter((c) => c.id === t.categoryId)
                      .map((c) => (c.groupName ? `${c.groupName} → ${c.name}` : c.name))[0]
                  }
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
        {selected && (
          <div className="review-banner">
            <div>
              <strong>
                {selected.reconciliationStatus === 'reconciled'
                  ? 'Conferida por arquivo'
                  : 'Pendente de conciliação'}
              </strong>
              <p>ID externo: {selected.sourceOperationId ?? 'Ainda não vinculado'}</p>
            </div>
          </div>
        )}
        {selected?.refundOfId && (
          <div className="review-banner">
            <div>
              <strong>Devolução vinculada à operação original</strong>
              <p>O valor reduz a receita ou despesa da categoria original na data da devolução.</p>
              <Link to={`/transactions?transaction=${selected.refundOfId}`}>
                Ver operação original
              </Link>
            </div>
          </div>
        )}
        {selected?.balanceAdjustment && (
          <div className="review-banner">
            <div>
              <strong>Correção de saldo manual</strong>
              <p>
                Anterior: {money(selected.balanceAdjustment.previousBalance)} · Corrigido:{' '}
                {money(selected.balanceAdjustment.targetBalance)}
              </p>
              <p>Motivo: {selected.balanceAdjustment.reason}</p>
              <p>Este ajuste preserva o histórico e não conta como receita ou despesa.</p>
            </div>
          </div>
        )}
        {selected && <TransactionSources transactionId={selected.id} />}
        {accounts.isError || categories.isError ? (
          <ErrorState error={accounts.error ?? categories.error} />
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
