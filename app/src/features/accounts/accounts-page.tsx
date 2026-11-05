import { useNotifications } from '../../shared/feedback/notification-provider';
import { FinanceAreaNav } from '../../shared/navigation/finance-area-nav';
import { PageHeader } from '../../shared/ui/page-header';
import { AccountRecord } from './components/account-record';
import { BalanceHistoryPanel } from './components/balance-history-panel';
import { BalanceAdjustmentForm } from './components/balance-adjustment-form';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { AccountForm } from './components/account-form';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { request } from '../../shared/api/client';
import type { Account, BalanceReferenceResult } from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
export function AccountsPage() {
  const { session } = useAuth();
  const client = useQueryClient();
  const [referenceBusy, setReferenceBusy] = useState<string | null>(null);
  const {
    success: setReferenceMessage,
    warning: notifyWarning,
    info: notifyInfo,
    error: notifyError,
    dismiss: dismissNotice,
  } = useNotifications();
  async function updateReference(account: Account) {
    setReferenceBusy(account.id);
    dismissNotice(`balance-reference:${account.id}`);
    setReferenceMessage('');
    try {
      const result = await request<BalanceReferenceResult>(
        `/accounts/${account.id}/balance-reference`,
        { method: 'POST', headers: { 'If-Match': String(account.version) } },
      );
      const message =
        result.status === 'conflict'
          ? 'Existem referências do mesmo dia sem ordem comprovada. Confira a origem do saldo.'
          : result.status === 'manual_preserved'
            ? 'Sua conferência manual foi preservada porque o extrato não comprova um saldo posterior.'
            : result.status === 'unavailable'
              ? 'Ainda não há extrato confirmado com saldo válido para esta conta.'
              : 'Referência de saldo conferida com os extratos confirmados.';
      if (result.status === 'conflict')
        notifyWarning(message, { id: `balance-reference:${account.id}` });
      else if (result.status === 'unavailable' || result.status === 'manual_preserved')
        notifyInfo(message, { id: `balance-reference:${account.id}` });
      else setReferenceMessage(message);
      await client.invalidateQueries();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Não foi possível conferir o saldo.', {
        id: `balance-reference:${account.id}`,
      });
    } finally {
      setReferenceBusy(null);
    }
  }
  const [scope, setScope] = useState('all');
  const [open, setOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<Account>();
  const [historyAccount, setHistoryAccount] = useState<Account>();
  const [editing, setEditing] = useState<Account>();
  const accounts = useQuery({
    queryKey: [session?.user.id, 'accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const visibleAccounts = (accounts.data ?? []).filter(
    (a) =>
      scope === 'all' ||
      (scope === 'benefits'
        ? a.type.startsWith('benefit_')
        : scope === 'reserve'
          ? a.type === 'reserve'
          : !a.type.startsWith('benefit_') && a.type !== 'reserve'),
  );
  return (
    <div className="page-enter accounts-page">
      <PageHeader title={<>Minhas contas</>} navigation={<FinanceAreaNav />}>
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
      </PageHeader>

      <ViewSwitcher
        variant="tabs"
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
          <p className="account-list-caption">
            {visibleAccounts.length} {visibleAccounts.length === 1 ? 'conta' : 'contas'} neste
            filtro
          </p>
          {!visibleAccounts.length && (
            <EmptyState title="Nenhuma conta neste filtro">
              Escolha outro tipo de conta ou adicione uma conta.
            </EmptyState>
          )}
          {visibleAccounts.map((a) => (
            <AccountRecord
              key={a.id}
              account={a}
              updating={referenceBusy === a.id}
              updateDisabled={referenceBusy !== null || !navigator.onLine}
              onUpdate={() => void updateReference(a)}
              onHistory={() => setHistoryAccount(a)}
              onCorrect={() => setAdjusting(a)}
              onEdit={() => {
                setEditing(a);
                setOpen(true);
              }}
            />
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
            Adicione sua conta Mercado Pago ou Alelo para começar.
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
              setReferenceMessage('Saldo corrigido. O histórico foi preservado.');
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
            setReferenceMessage('Conta salva.');
            setOpen(false);
            void client.invalidateQueries();
          }}
        />
      </Modal>
    </div>
  );
}
