import { Search as EmptyStateIcon } from 'lucide-react';
import { DatePicker } from '../../shared/ui/controls/date-picker';
import { Select } from '../../shared/ui/controls/select';
import './transactions.css';
import { useNotifications } from '../../shared/feedback/notification-provider';
import { PageHeader } from '../../shared/ui/page-header';
import { dateToday, money } from '../../shared/formatting/money';
import { TransactionSources } from './components/transaction-sources';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { CategorySelect } from '../../shared/ui/category-select';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { request } from '../../shared/api/client';
import type { Account, Category, Collection, Transaction } from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { MovementTable } from './components/movement-table';
import { monthDates, shiftMonth } from '../../shared/formatting/month';
import { Tooltip } from '../../shared/ui/tooltip';
import { TransactionForm } from './components/transaction-form';
function dateFilter(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const parsed = new Date(value + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : '';
}
export function TransactionsPage() {
  const { session } = useAuth();
  const notices = useNotifications();
  const { accountId } = useParams();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const [open, setOpen] = useState(params.has('new'));
  const [selected, setSelected] = useState<Transaction>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customPeriod, setCustomPeriod] = useState(false);
  const fromInput = useRef<HTMLInputElement>(null);
  const rangeErrorId = useId();
  const search = params.get('search') ?? '';
  const account = params.get('accountId') ?? accountId ?? '';
  const kind = params.get('type') ?? '';
  const category = params.get('categoryId') ?? '';
  const reconciliation = params.get('reconciliation') ?? '';
  const from = dateFilter(params.get('from'));
  const to = dateFilter(params.get('to'));
  function changeFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  const setSearch = (value: string) => changeFilter('search', value);
  const setAccount = (value: string) => changeFilter('accountId', value);
  const setKind = (value: string) => {
    const next = new URLSearchParams(params);
    next.delete('categoryId');
    if (value) next.set('type', value);
    else next.delete('type');
    setParams(next, { replace: true, preventScrollReset: true });
  };
  const setCategory = (value: string) => changeFilter('categoryId', value);
  const setReconciliation = (value: string) => changeFilter('reconciliation', value);
  const setFrom = (value: string) => {
    setCustomPeriod(true);
    changeFilter('from', value);
  };
  const setTo = (value: string) => {
    setCustomPeriod(true);
    changeFilter('to', value);
  };
  const thisMonth = dateToday().slice(0, 7);
  const currentDates = monthDates(thisMonth),
    previousDates = monthDates(shiftMonth(thisMonth, -1));
  const rangeInvalid = !!(from && to && from > to);
  const period = customPeriod
    ? 'custom'
    : !from && !to
      ? 'all'
      : from === currentDates.from && to === currentDates.to
        ? 'current'
        : from === previousDates.from && to === previousDates.to
          ? 'previous'
          : 'custom';
  function changePeriod(value: string) {
    setCustomPeriod(value === 'custom');
    if (value === 'custom') {
      fromInput.current?.focus();
      return;
    }
    const next = new URLSearchParams(params);
    const dates = value === 'current' ? currentDates : value === 'previous' ? previousDates : null;
    if (dates) {
      next.set('from', dates.from);
      next.set('to', dates.to);
    } else {
      next.delete('from');
      next.delete('to');
    }
    setParams(next, { replace: true, preventScrollReset: true });
  }
  useEffect(() => {
    if (params.has('new')) {
      setSelected(undefined);
      setOpen(true);
    } else if (params.has('transaction')) setOpen(true);
    else {
      setOpen(false);
      setSelected(undefined);
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
    enabled: !rangeInvalid,
    placeholderData: keepPreviousData,
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
  const activeFilters = [
    ...(params.get('accountId')
      ? [{ key: 'accountId', label: accounts.data?.find((a) => a.id === account)?.name ?? 'Conta' }]
      : []),
    ...(category
      ? [
          {
            key: 'categoryId',
            label: categories.data?.find((c) => c.id === category)?.name ?? 'Categoria',
          },
        ]
      : []),
    ...(reconciliation
      ? [
          {
            key: 'reconciliation',
            label: reconciliation === 'pending' ? 'Conciliação pendente' : 'Conferidas por arquivo',
          },
        ]
      : []),
    ...(from ? [{ key: 'from', label: `Desde ${from.split('-').reverse().join('/')}` }] : []),
    ...(to ? [{ key: 'to', label: `Até ${to.split('-').reverse().join('/')}` }] : []),
  ];

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
    <div className="page-enter transactions-page">
      <PageHeader title={accountName ?? 'Movimentações'}></PageHeader>
      {requestedTransaction.isError && <ErrorState error={requestedTransaction.error} />}
      <section className="movements-workbench" aria-label="Lista de movimentações">
        <div className="movement-toolbar">
          <Button
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('new', '1');
              setParams(next, { preventScrollReset: true });
            }}
          >
            <Plus size={18} />
            Novo lançamento
          </Button>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Buscar movimentos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar movimentos…"
            />
          </label>
          <div className="movement-period">
            <label className="movement-preset">
              <span className="sr-only">Período</span>
              <Select
                aria-label="Período dos movimentos"
                value={period}
                onChange={(e) => changePeriod(e.target.value)}
              >
                <option value="all">Todo o período</option>
                <option value="current">Mês atual</option>
                <option value="previous">Mês anterior</option>
                <option value="custom">Personalizado</option>
              </Select>
            </label>
            <label className="movement-date">
              <span>De</span>
              <DatePicker
                ref={fromInput}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-invalid={rangeInvalid}
                aria-describedby={rangeInvalid ? rangeErrorId : undefined}
              />
            </label>
            <label className="movement-date">
              <span>Até</span>
              <DatePicker
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-invalid={rangeInvalid}
                aria-describedby={rangeInvalid ? rangeErrorId : undefined}
              />
            </label>
          </div>
          <Tooltip text="Filtrar conta, categoria e conciliação">
            <button
              type="button"
              className="icon-button movement-filter-trigger"
              aria-label="Filtros avançados"
              aria-haspopup="dialog"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={18} />
              {activeFilters.some((f) => !['from', 'to'].includes(f.key)) && (
                <span className="filter-active-dot" />
              )}
            </button>
          </Tooltip>
        </div>
        <div className="movement-typebar">
          <ViewSwitcher
            variant="tabs"
            label="Tipos de movimentos"
            value={kind}
            onChange={(value) => {
              setKind(value);
            }}
            options={[
              { value: '', label: 'Todos' },
              { value: 'expense', label: 'Despesas' },
              { value: 'income', label: 'Receitas' },
              { value: 'transfer', label: 'Transferências' },
              { value: 'unclassified', label: 'A revisar' },
            ]}
          />
          {!entries.isPending && !entries.isError && !rangeInvalid && (
            <span className="movement-results" role="status">
              {entries.isPlaceholderData
                ? 'Atualizando movimentos…'
                : `${items.length} ${items.length === 1 ? 'movimento carregado' : 'movimentos carregados'}`}
              {entries.hasNextPage && !entries.isPlaceholderData ? ' · há mais resultados' : ''}
            </span>
          )}
        </div>
        <Modal
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          title="Filtros avançados"
          description="Selecione conta, categoria e situação. O período fica na busca principal."
        >
          <div className="expanded-filters">
            <label>
              Conciliação
              <Select
                aria-label="Filtrar conciliação"
                value={reconciliation}
                onChange={(event) => setReconciliation(event.target.value)}
              >
                <option value="">Todas</option>
                <option value="pending">Pendentes</option>
                <option value="reconciled">Conferidas por arquivo</option>
              </Select>
            </label>
            <label>
              Conta
              <Select
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
              </Select>
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

            <button
              className="text-button"
              onClick={() => {
                const next = new URLSearchParams(params);
                for (const key of ['accountId', 'categoryId', 'reconciliation']) next.delete(key);
                setParams(next, { replace: true, preventScrollReset: true });
              }}
            >
              Limpar filtros avançados
            </button>
          </div>
        </Modal>
        {(activeFilters.some((f) => !['from', 'to'].includes(f.key)) || search) && (
          <div className="active-filters" aria-label="Filtros aplicados">
            {activeFilters
              .filter((f) => !['from', 'to'].includes(f.key))
              .map((filter) => (
                <button
                  className="filter-chip"
                  key={filter.key}
                  onClick={() => changeFilter(filter.key, '')}
                  aria-label={`Remover filtro: ${filter.label}`}
                >
                  {filter.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            <button
              className="text-button"
              onClick={() =>
                setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })
              }
            >
              Limpar filtros
            </button>
          </div>
        )}
        {rangeInvalid ? (
          <p id={rangeErrorId} className="form-error movement-date-error" role="alert">
            A data inicial deve ser anterior ou igual à data final.
          </p>
        ) : entries.isPending ? (
          <Loading />
        ) : entries.isError ? (
          <ErrorState error={entries.error} retry={() => void entries.refetch()} />
        ) : items.length ? (
          <>
            <div
              className="ledger-table-area motion-reveal"
              aria-busy={entries.isFetching}
              data-updating={entries.isPlaceholderData}
              inert={entries.isPlaceholderData}
            >
              <MovementTable
                items={items}
                accounts={accounts.data ?? []}
                categories={categories.data ?? []}
                onOpen={(item) => {
                  setSelected(undefined);
                  const next = new URLSearchParams(params);
                  next.set('transaction', item.id);
                  next.delete('new');
                  setParams(next, { preventScrollReset: true });
                }}
              />
            </div>
            {entries.hasNextPage && (
              <div className="load-more">
                <Button
                  className="secondary"
                  disabled={entries.isFetchingNextPage || entries.isPlaceholderData}
                  onClick={() => void entries.fetchNextPage()}
                >
                  Carregar mais movimentos
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<EmptyStateIcon size={28} strokeWidth={1.5} />}
            title={
              search || activeFilters.length || from || to || kind
                ? 'Nenhum movimento neste filtro'
                : 'Seu histórico começa aqui'
            }
            action={
              search || activeFilters.length || from || to || kind ? (
                <Link to="/transactions" className="button secondary">
                  Limpar filtros
                </Link>
              ) : (
                <Link to="/imports" className="button secondary">
                  Importar extrato
                </Link>
              )
            }
          >
            {search || activeFilters.length || from || to || kind
              ? 'Ajuste a busca ou os filtros para consultar outros movimentos.'
              : 'Importe um extrato ou use Novo lançamento para começar.'}
          </EmptyState>
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : close())}
        variant={transactionId ? 'detail' : 'dialog'}
        title={transactionId ? 'Detalhes do movimento' : 'Novo lançamento'}
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
        {transactionId && requestedTransaction.isPending ? (
          <Loading />
        ) : requestedTransaction.isError ? (
          <ErrorState
            error={requestedTransaction.error}
            retry={() => void requestedTransaction.refetch()}
          />
        ) : accounts.isError || categories.isError ? (
          <ErrorState error={accounts.error ?? categories.error} />
        ) : accounts.isPending || categories.isPending ? (
          <Loading />
        ) : selected?.managedKind ? (
          <div className="form-stack">
            <p>
              Este movimento é gerenciado pelo módulo de{' '}
              {selected.managedKind === 'card' ? 'cartões' : 'investimentos'}. Use esse módulo para
              corrigir compras, pagamentos, aportes e resgates.
            </p>
            <Link
              className="button secondary"
              to={selected.managedKind === 'card' ? '/cards' : '/wealth'}
            >
              Abrir {selected.managedKind === 'card' ? 'cartões e faturas' : 'investimentos'}
            </Link>
          </div>
        ) : (
          <TransactionForm
            key={selected?.id ?? 'new'}
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
            entry={selected}
            onSaved={() => {
              notices.success('Lançamento salvo.');
              close();
              void client.invalidateQueries();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
