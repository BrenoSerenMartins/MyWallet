import { Link } from 'react-router-dom';
import type { ImportBatch } from '../../../shared/api/resources';
import { money, shortDate } from '../../../shared/formatting/money';
export function ReconciliationGap({ batch }: { batch: ImportBatch }) {
  return (
    <div className="form-error reconciliation-gap" role="alert">
      <strong>
        {batch.openingDateMismatch
          ? 'Este extrato é anterior ao início cadastrado da conta.'
          : 'Falta conciliar o período anterior a este extrato.'}
      </strong>
      <p>
        O extrato começa com{' '}
        {batch.openingBalance === null ? 'saldo não informado' : money(batch.openingBalance)}. Os
        lançamentos confirmados
        {batch.statementStartDate ? ` antes de ${shortDate(batch.statementStartDate)}` : ''} somam
        uma posição de {money(batch.recordedOpeningBalance)}.
        {batch.openingDifference != null && (
          <>
            {' '}
            Diferença: <strong>{money(batch.openingDifference)}</strong>.
          </>
        )}
      </p>
      <p>
        {batch.openingDateMismatch
          ? 'A conta já tem movimentações. Este arquivo pode ser guardado para consulta; a data de abertura não será alterada por esta importação.'
          : 'A abertura da conta será mantida. Conclua os extratos anteriores e confira se houve movimentos desmarcados, faltantes ou alterados. Enviar um arquivo ou salvá-lo para consulta ainda não o inclui no saldo.'}
      </p>
      {!!batch.previousImports?.length && (
        <div className="previous-imports">
          <strong>Arquivos anteriores ainda sem confirmação</strong>
          {batch.previousImports.map((previous) => (
            <Link to={`/imports/${previous.id}`} key={previous.id}>
              <span>
                <strong>
                  {shortDate(previous.firstDate)} – {shortDate(previous.lastDate)}
                </strong>
                <small>{previous.fileName}</small>
              </span>
              <span>
                {previous.status === 'history' ? 'Somente consulta' : 'Continuar revisão'} →
              </span>
            </Link>
          ))}
        </div>
      )}
      <Link className="button secondary compact" to={`/accounts/${batch.accountId}`}>
        Conferir movimentações da conta
      </Link>
    </div>
  );
}
