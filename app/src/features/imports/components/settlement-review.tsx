import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../../../shared/api/client';
import type { ImportBatch, SettlementMatch } from '../../../shared/api/resources';
import { money, shortDate } from '../../../shared/formatting/money';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { SettlementDetails } from '../../../shared/ui/settlement-details';
import { ReprocessImport } from './reprocess-import';
const labels = {
  matched: 'Correspondente',
  ambiguous: 'Conferir',
  unmatched: 'Sem correspondência',
  unsupported: 'Evento não mapeado',
};
export function SettlementReview({
  batch,
  refresh,
}: {
  batch: ImportBatch;
  refresh: () => Promise<unknown>;
}) {
  const client = useQueryClient();
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = useQuery({
    queryKey: ['settlement-matches', batch.id, batch.version],
    queryFn: () => request<SettlementMatch[]>(`/imports/${batch.id}/matches`),
  });
  const byItem = new Map(matches.data?.map((match) => [match.itemId, match]));
  const matched = matches.data?.filter((match) => match.status === 'matched').length ?? 0;
  const items = batch.items.filter((item) => {
    const match = byItem.get(item.id);
    const visible =
      view === 'all' ||
      (view === 'matched' ? match?.status === 'matched' : match && match.status !== 'matched');
    return (
      visible &&
      `${item.description} ${item.transactionDate} ${item.sourceOperationId ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR'))
    );
  });
  async function retain() {
    setBusy(true);
    setError('');
    try {
      await request(`/imports/${batch.id}/history`, {
        method: 'POST',
        body: JSON.stringify({ version: batch.version }),
      });
      await refresh();
      await client.invalidateQueries();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o relatório.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ReprocessImport
        batch={batch}
        onProcessed={async () => {
          await refresh();
          await client.invalidateQueries();
        }}
      />
      <div className="review-banner">
        <div>
          <strong>
            {batch.status === 'history'
              ? 'Relatório salvo · detalhes disponíveis nos movimentos correspondentes'
              : 'Complemente seus movimentos com os detalhes do Mercado Pago'}
          </strong>
          <p>
            {matched} de {batch.items.length} registros correspondem a lançamentos confirmados. Este
            cruzamento não cria lançamentos nem altera saldos ou categorias.
          </p>
          {batch.status === 'draft' && (
            <p>
              Salve o relatório para consultar os detalhes nas movimentações. Novos extratos
              confirmados serão cruzados automaticamente.
            </p>
          )}
        </div>
        {batch.status === 'draft' && (
          <Button disabled={busy || !navigator.onLine} onClick={() => void retain()}>
            {busy ? 'Salvando…' : 'Salvar relatório e complementar detalhes'}
          </Button>
        )}
      </div>
      <p className="field-help">
        Sem correspondência não significa movimento novo. Datas, liberações ou valores podem diferir
        entre os relatórios; estes registros continuam disponíveis para consulta.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {matches.isPending ? (
        <Loading />
      ) : matches.isError ? (
        <ErrorState error={matches.error} retry={() => void matches.refetch()} />
      ) : (
        <>
          <ViewSwitcher
            label="Correspondências do relatório"
            value={view}
            onChange={(value) => {
              setView(value);
              setPage(0);
            }}
            options={[
              { value: 'all', label: 'Todos', count: batch.items.length },
              { value: 'matched', label: 'Correspondentes', count: matched },
              {
                value: 'pending',
                label: 'Sem vínculo automático',
                count: batch.items.length - matched,
              },
            ]}
          />
          <label className="import-search">
            Buscar no relatório
            <input
              type="search"
              value={search}
              placeholder="Descrição, data ou referência"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <div className="panel review-table-wrap">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Data / evento</th>
                  <th>Correspondência</th>
                  <th>Valor líquido</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(page * 25, (page + 1) * 25).map((item) => {
                  const match = byItem.get(item.id);
                  return (
                    <tr key={item.id}>
                      <td data-label="Evento">
                        <span className="review-date">{shortDate(item.transactionDate)}</span>
                        <strong>{item.description}</strong>
                        <details className="movement-details">
                          <summary>Referência</summary>
                          <p>
                            {item.sourceOperationId ?? 'Não informada'} · Linha {item.sourceRow}
                          </p>
                        </details>
                        <SettlementDetails metadata={item.metadata} />
                      </td>
                      <td data-label="Correspondência">
                        <span className="badge">
                          {match ? labels[match.status] : 'Sem evidência'}
                        </span>
                        <p className="field-help">{match?.reason}</p>
                        {match?.transactionId && (
                          <Link to={`/transactions?transaction=${match.transactionId}`}>
                            Ver movimento
                          </Link>
                        )}
                      </td>
                      <td data-label="Valor líquido" className="numeric">
                        {money(item.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!items.length && <p className="field-help">Nenhum registro para este filtro.</p>}
            <div className="review-pagination">
              <span>
                Página {page + 1} de {Math.max(1, Math.ceil(items.length / 25))}
              </span>
              <div>
                <Button className="secondary" disabled={!page} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <Button
                  className="secondary"
                  disabled={(page + 1) * 25 >= items.length}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
