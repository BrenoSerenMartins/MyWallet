import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../../../shared/api/client';
import type { SettlementMatch } from '../../../shared/api/resources';
import { SettlementDetails } from '../../../shared/ui/settlement-details';
export function TransactionSources({ transactionId }: { transactionId: string }) {
  const sources = useQuery({
    queryKey: ['transaction-sources', transactionId],
    queryFn: () => request<SettlementMatch[]>(`/imports/transaction-sources/${transactionId}`),
  });
  if (sources.isPending)
    return (
      <p className="field-help" role="status">
        Consultando detalhes do Mercado Pago…
      </p>
    );
  if (sources.isError)
    return (
      <p role="alert" className="field-help">
        Não foi possível consultar os relatórios complementares.{' '}
        <button className="text-button" onClick={() => void sources.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!sources.data.length) return null;
  return (
    <section aria-label="Detalhes complementares do Mercado Pago" className="review-banner">
      <div>
        <strong>Detalhes do Mercado Pago</strong>
        <p>
          Correspondência pela referência, data e valor originais. Seus valores e categorias foram
          preservados.
        </p>
        {sources.data.map((source) => (
          <div key={source.itemId}>
            <Link to={`/imports/${source.batchId}`}>Ver relatório de origem</Link>
            <SettlementDetails metadata={source.metadata} />
          </div>
        ))}
      </div>
    </section>
  );
}
