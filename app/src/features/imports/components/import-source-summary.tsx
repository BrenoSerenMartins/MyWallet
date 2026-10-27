import { ReconciliationGap } from './reconciliation-gap';
import type { ImportBatch } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { CheckCircle2, Info } from 'lucide-react';
export function ImportSourceSummary({ batch }: { batch: ImportBatch }) {
  const hasBalances = batch.reconciliationCapability === 'running_balance';
  return (
    <details className="source-details">
      <summary>Arquivo e conciliação · {batch.sourceFormat?.toUpperCase() ?? 'PDF'}</summary>
      <p className="field-help">
        {batch.fileName} ·{' '}
        {batch.institution === 'alelo' ? 'Extrato Alelo.' : 'Extrato de conta Mercado Pago.'}{' '}
        Valores e referências preservados para conferência.
      </p>
      <section className="review-summary">
        <div className="panel">
          <span>Movimentos no arquivo</span>
          <strong>{batch.items.length}</strong>
        </div>
        {batch.openingBalance !== null && (
          <div className="panel">
            <span>Saldo anterior informado no arquivo</span>
            <strong>
              {batch.openingBalance === null ? 'Não informado' : money(batch.openingBalance)}
            </strong>
          </div>
        )}
        {batch.closingBalance !== null && (
          <div className="panel">
            <span>Saldo final informado no arquivo</span>
            <strong>
              {batch.closingBalance === null ? 'Não informado' : money(batch.closingBalance)}
            </strong>
          </div>
        )}
        <div className="panel">
          <span>Conferência do arquivo</span>
          <strong className={hasBalances ? 'positive-text' : 'muted'}>
            {hasBalances ? <CheckCircle2 size={18} /> : <Info size={18} />}{' '}
            {hasBalances ? 'Saldos conferidos' : 'Movimentos sem conferência de saldo'}
          </strong>
        </div>
      </section>
      {batch.status !== 'reversed' && batch.openingMismatch && <ReconciliationGap batch={batch} />}
    </details>
  );
}
