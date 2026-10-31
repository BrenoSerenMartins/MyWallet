import { Link } from 'react-router-dom';
import type { ImportBatch } from '../../../shared/api/resources';
import { money, shortDate } from '../../../shared/formatting/money';
export function ReconciliationGap({ batch }: { batch: ImportBatch }) {
  return (
    <div className="review-banner reconciliation-gap" role="status">
      <strong>
        {batch.openingMismatch
          ? 'Diferença no histórico · a importação pode continuar'
          : 'Histórico com arquivos pendentes'}
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
        {batch.institution === 'alelo'
          ? 'Os movimentos novos podem ser confirmados, inclusive os antigos. Use Corrigir saldo na conta para registrar uma diferença conhecida.'
          : 'No Mercado Pago, o saldo atual pode usar uma referência mais recente do extrato confirmado. Diferenças neste histórico não bloqueiam a importação nem exigem corrigir o saldo manualmente. Os relatórios anteriores continuam dependendo dos movimentos importados.'}
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
