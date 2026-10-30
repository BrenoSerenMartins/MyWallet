import { BalanceHistoryPanel } from './components/balance-history-panel';
import { BalanceAdjustmentForm } from './components/balance-adjustment-form';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { AccountForm } from './components/account-form';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Landmark, Plus } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { request } from '../../shared/api/client';
import type { Account } from '../../shared/api/resources';
import { money } from '../../shared/formatting/money';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
export function AccountsPage() {
  const { session } = useAuth();
  const client = useQueryClient();
  const [scope, setScope] = useState('all');
  const [open, setOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<Account>();
  const [historyAccount, setHistoryAccount] = useState<Account>();
  const [editing, setEditing] = useState<Account>();
  const accounts = useQuery({
    queryKey: [session?.user.id, 'accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA PARTE DO SEU DINHEIRO</span>
          <h1>Minhas contas</h1>
          <p>Reúna suas contas e enxergue o conjunto com clareza.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
          disabled={!navigator.onLine}
        >
          <Plus size={18} />
          Adicionar conta
        </Button>
      </div>
      <ViewSwitcher
        label="Tipos de contas"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'all', label: 'Todas' },
          { value: 'cash', label: 'Dinheiro' },
          { value: 'benefits', label: 'Benefícios' },
          { value: 'reserve', label: 'Reservas' },
        ]}
      />
      {accounts.isPending ? (
        <Loading />
      ) : accounts.isError ? (
        <ErrorState error={accounts.error} retry={() => void accounts.refetch()} />
      ) : accounts.data.length ? (
        <div className="accounts-grid">
          {accounts.data
            .filter(
              (a) =>
                scope === 'all' ||
                (scope === 'benefits'
                  ? a.type.startsWith('benefit_')
                  : scope === 'reserve'
                    ? a.type === 'reserve'
                    : !a.type.startsWith('benefit_') && a.type !== 'reserve'),
            )
            .map((a) => (
              <article className="account-card panel" key={a.id}>
                <div className="account-card-top">
                  <span
                    className={`bank-icon large ${a.institution === 'mercado_pago' ? 'mp' : ''}`}
                  >
                    {a.institution === 'mercado_pago' ? 'mp' : <Landmark size={23} />}
                  </span>
                  <ArrowUpRight size={20} />
                </div>
                <h2>
                  <Link to={`/accounts/${a.id}`}>{a.name}</Link>
                </h2>
                <p>
                  {a.institution === 'mercado_pago' ? 'Mercado Pago' : a.institution} ·{' '}
                  {a.type === 'benefit_food'
                    ? 'Vale-alimentação'
                    : a.type === 'benefit_meal'
                      ? 'Vale-refeição'
                      : a.type === 'reserve'
                        ? 'Reserva'
                        : 'Conta pessoal'}
                </p>
                <span className="eyebrow">SALDO REGISTRADO</span>
                <strong className="account-card-balance">{money(a.balance)}</strong>
                {a.balanceBasis?.kind === 'unknown' && (
                  <small>Histórico parcial · saldo atual ainda não conferido</small>
                )}
                {a.balanceBasis?.reviewRequired && (
                  <small role="status">Confira o saldo após as novas importações.</small>
                )}
                <div className="account-card-footer">
                  <Link to={`/accounts/${a.id}`}>
                    Ver movimentações <ArrowUpRight size={16} />
                  </Link>
                  <button className="text-button" onClick={() => setHistoryAccount(a)}>
                    Histórico de saldo
                  </button>
                  <button className="text-button" onClick={() => setAdjusting(a)}>
                    Corrigir saldo
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEditing(a);
                      setOpen(true);
                    }}
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="Dê um lugar para o seu dinheiro"
            action={
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setOpen(true);
                }}
              >
                <Plus size={17} />
                Criar minha primeira conta
              </Button>
            }
          >
            Adicione seu Mercado Pago ou outra conta para começar a organizar seus movimentos.
          </EmptyState>
        </div>
      )}
      <Modal
        open={!!historyAccount}
        onOpenChange={(value) => !value && setHistoryAccount(undefined)}
        title="Histórico de saldo"
      >
        {historyAccount && (
          <BalanceHistoryPanel
            account={historyAccount}
            onChanged={() => {
              setHistoryAccount(undefined);
              void client.invalidateQueries();
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!adjusting}
        onOpenChange={(value) => !value && setAdjusting(undefined)}
        title="Corrigir saldo atual"
      >
        {adjusting && (
          <BalanceAdjustmentForm
            key={adjusting.id}
            account={adjusting}
            onSaved={() => {
              setAdjusting(undefined);
              void client.invalidateQueries();
            }}
          />
        )}
      </Modal>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Editar conta' : 'Adicionar conta'}
        description="Identifique a conta e importe seu histórico ou adicione movimentos."
      >
        <AccountForm
          key={editing?.id ?? 'new'}
          account={editing}
          onSaved={() => {
            setOpen(false);
            void client.invalidateQueries();
          }}
        />
      </Modal>
    </div>
  );
}
