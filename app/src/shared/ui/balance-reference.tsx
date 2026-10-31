import { Link } from 'react-router-dom';
import { FileCheck2, History } from 'lucide-react';
import type { Account } from '../api/resources';
export function BalanceReference({
  account,
  compact = false,
}: {
  account: Pick<Account, 'balanceBasis' | 'institution'>;
  compact?: boolean;
}) {
  const basis = account.balanceBasis;
  if (!basis || basis.kind === 'unknown' || basis.kind === 'legacy')
    return <span className="balance-reference muted">Saldo sem referência atual conferida</span>;
  const date = basis.referenceDate
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(basis.referenceDate + 'T12:00:00'))
    : '';
  const bank = account.institution === 'mercado_pago' && basis.kind === 'statement';
  return (
    <div className={`balance-reference ${compact ? 'compact' : ''}`}>
      {bank ? (
        <FileCheck2 size={16} aria-hidden="true" />
      ) : (
        <History size={16} aria-hidden="true" />
      )}
      <span>
        {bank
          ? basis.referencePoint === 'closing'
            ? 'Referência do extrato'
            : 'Referência de abertura'
          : 'Conferido por você'}
        {date ? ` · ${date}` : ''}
      </span>
      {bank && basis.importId && <Link to={`/imports/${basis.importId}`}>Ver origem</Link>}
      {basis.reviewRequired && (
        <small role="status">
          {basis.reviewReason === 'same_day'
            ? 'Há movimentos do mesmo dia cuja ordem precisa de conferência.'
            : 'Há referências divergentes para conferir.'}
        </small>
      )}
    </div>
  );
}
