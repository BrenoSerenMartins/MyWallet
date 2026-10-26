import type { ImportBatch } from '../../../shared/api/resources';
export function OpeningInitialization({ batch }: { batch: ImportBatch }) {
  if (!batch.willInitializeOpening) return null;
  return (
    <div className="review-banner">
      <div>
        <strong>
          {batch.openingBalance === null
            ? 'Data inicial identificada no arquivo'
            : 'Posição inicial identificada no extrato'}
        </strong>
        <p>
          {batch.openingBalance === null
            ? 'Ao confirmar, o app usará a primeira data do arquivo como início desta conta vazia. O saldo inicial cadastrado será preservado, pois o arquivo não fornece esse valor.'
            : 'Ao confirmar o primeiro extrato, o app usará o saldo inicial e a primeira data do arquivo para iniciar esta conta. Você não precisa preencher esses valores novamente.'}
        </p>
      </div>
    </div>
  );
}
