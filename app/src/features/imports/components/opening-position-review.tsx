import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Account, ImportBatch } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { money, shortDate } from '../../../shared/formatting/money';
import { Button, ErrorState, Loading, Modal } from '../../../shared/ui/primitives';
import { AccountForm } from '../../accounts/components/account-form';
export function OpeningPositionReview({
  batch,
  refresh,
}: {
  batch: ImportBatch;
  refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['import-account', batch.accountId],
    queryFn: () => request<Account>(`/accounts/${batch.accountId}`),
    enabled: open,
  });
  return (
    <div className="form-error" role="alert">
      <strong>A posição inicial da conta precisa de revisão.</strong>
      <p>
        {batch.openingDateMismatch && batch.statementStartDate
          ? `O extrato começa em ${shortDate(batch.statementStartDate)}, antes da posição inicial da conta (${shortDate(batch.accountOpeningDate)}). `
          : ''}
        O extrato começa com {money(batch.openingBalance)}; a posição registrada é{' '}
        {money(batch.recordedOpeningBalance)}. Você pode ajustar a posição de uma conta sem
        movimentos ou salvar o arquivo apenas para consulta.
      </p>
      <Button className="secondary compact" onClick={() => setOpen(true)}>
        Revisar posição inicial
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Conferir início da conta"
        description="A proposta usa o saldo inicial do extrato, não o saldo final. Confira antes de salvar."
      >
        {open &&
          (query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState error={query.error} />
          ) : (
            <>
              <p className="field-help">
                A data e o saldo abaixo foram preenchidos com o início deste extrato. Só serão
                alterados ao salvar. Contas com movimentos exigem conciliação e não permitem essa
                mudança direta.
              </p>
              <AccountForm
                key={query.data.version}
                account={{
                  ...query.data,
                  openingDate: batch.statementStartDate ?? query.data.openingDate,
                  openingBalance: batch.openingBalance,
                }}
                onSaved={() => {
                  setOpen(false);
                  void refresh();
                }}
              />
            </>
          ))}
      </Modal>
    </div>
  );
}
