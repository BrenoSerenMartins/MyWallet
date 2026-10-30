import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Account, ImportBatch } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { Button, Modal } from '../../../shared/ui/primitives';
import { BalanceAdjustmentForm } from '../../accounts/components/balance-adjustment-form';
export function ImportBalanceSetup({
  batch,
  refresh,
}: {
  batch: ImportBatch;
  refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const account = useQuery({
    queryKey: ['import-balance-account', batch.accountId, batch.version],
    queryFn: () => request<Account>(`/accounts/${batch.accountId}`),
    enabled: batch.status === 'confirmed',
  });
  const basis = account.data?.balanceBasis;
  if (
    batch.status !== 'confirmed' ||
    !account.data ||
    !basis ||
    (basis.kind !== 'unknown' && !basis.reviewRequired)
  )
    return null;
  async function useStatement() {
    setBusy(true);
    try {
      const result = await request<{ status: string }>(
        `/accounts/${batch.accountId}/balance-basis/imports/${batch.id}`,
        { method: 'POST' },
      );
      setMessage(
        result.status === 'applied'
          ? 'Saldo base identificado no extrato.'
          : result.status === 'partial'
            ? 'Há movimentos do arquivo sem confirmação; confira o saldo atual ou conclua a revisão.'
            : 'A referência existente foi preservada. Confira o saldo atual para resolver a diferença.',
      );
      await account.refetch();
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível conferir.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="review-banner" role="status">
        <div>
          <strong>
            {basis.reviewRequired ? 'Confira o saldo atual' : 'Quer alinhar o saldo da conta?'}
          </strong>
          <p>
            {basis.reviewRequired
              ? basis.reviewReason === 'statement_conflict'
                ? 'O saldo informado em um extrato não coincide com a referência existente. Sua base foi preservada; confira o saldo atual.'
                : 'Entraram movimentos da mesma data da última conferência. O arquivo não informa se ocorreram antes ou depois dela.'
              : 'Se o histórico estiver incompleto, informe opcionalmente o saldo atual. O app calcula o saldo base sem criar lançamentos financeiros.'}
          </p>
          <Button className="secondary" onClick={() => setOpen(true)}>
            Informar saldo atual (opcional)
          </Button>
          {batch.reportType === 'account_statement' && batch.openingBalance !== null && (
            <Button className="secondary" disabled={busy} onClick={() => void useStatement()}>
              Usar saldo informado no extrato
            </Button>
          )}
          {message && <p>{message}</p>}
        </div>
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Conferir saldo atual">
        <BalanceAdjustmentForm
          account={account.data}
          initial
          onSaved={() => {
            setOpen(false);
            void account.refetch();
            void refresh();
          }}
        />
      </Modal>
    </>
  );
}
