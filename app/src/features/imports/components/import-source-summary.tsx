import type { ImportBatch } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { CheckCircle2, Info } from 'lucide-react';
export function ImportSourceSummary({ batch }: { batch: ImportBatch }) {
  const canIntegrate = batch.canIntegrate !== false;
  return (
    <details className="source-details">
      <summary>Arquivo e conciliação · {batch.sourceFormat?.toUpperCase() ?? 'PDF'}</summary>
      <p className="field-help">
        {batch.fileName} ·{' '}
        {canIntegrate ? 'Extrato de conta Mercado Pago.' : 'Relatório de liquidações Mercado Pago.'}{' '}
        Valores e referências preservados para conferência.
      </p>
      <section className="review-summary">
        <div className="panel">
          <span>Movimentos no arquivo</span>
          <strong>{batch.items.length}</strong>
        </div>
        <div className="panel">
          <span>Saldo inicial do extrato</span>
          <strong>
            {batch.openingBalance === null ? 'Não informado' : money(batch.openingBalance)}
          </strong>
        </div>
        <div className="panel">
          <span>Saldo final do extrato</span>
          <strong>
            {batch.closingBalance === null ? 'Não informado' : money(batch.closingBalance)}
          </strong>
        </div>
        <div className="panel">
          <span>Conferência do arquivo</span>
          <strong className={canIntegrate ? 'positive-text' : 'muted'}>
            {canIntegrate ? <CheckCircle2 size={18} /> : <Info size={18} />}{' '}
            {canIntegrate ? 'Saldos conferidos' : 'Sem saldos no relatório'}
          </strong>
        </div>
      </section>
    </details>
  );
}
