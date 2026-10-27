import type { ImportBatch } from '../../../shared/api/resources';
export function OpeningInitialization({ batch }: { batch: ImportBatch }) {
  if (!batch.willInitializeOpening) return null;
  return (
    <div className="review-banner">
      <div>
        <strong>
          {batch.openingBalance === null
            ? 'Histórico pronto para importar'
            : 'Saldo anterior ao período identificado no extrato'}
        </strong>
        <p>
          {batch.openingBalance === null
            ? 'Você pode confirmar movimentos antigos sem configurar uma data de início. Este arquivo não informa o saldo anterior ao período; o app não vai inventar esse valor.'
            : 'O app identificou o saldo que já existia antes dos movimentos deste primeiro extrato. Ele será considerado automaticamente ao confirmar, sem preencher valores manualmente.'}
        </p>
      </div>
    </div>
  );
}
