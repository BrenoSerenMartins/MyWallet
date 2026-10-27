import { useState } from 'react';
import { useImportReview } from '../hooks/use-import-review';
import type { ImportBatch } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
import { ImportReviewRow } from './import-review-row';

// Retained only to inspect or undo imports created before statement-only ingestion.
export function SettlementReview({
  batch,
  refresh,
}: {
  batch: ImportBatch;
  refresh: () => Promise<unknown>;
}) {
  const { categories, page, setPage, busy, error, reverse } = useImportReview(batch, refresh);
  const [search, setSearch] = useState('');
  const items = batch.items.filter((item) =>
    `${item.description} ${item.transactionDate} ${item.sourceOperationId ?? ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <div className="review-banner" role="status">
        <div>
          <strong>Relatório EDI antigo · disponível para consulta</strong>
          <p>
            O app agora importa extratos de conta. Este relatório e os lançamentos já confirmados
            foram preservados. O EDI não pode criar ou conciliar novos lançamentos.
          </p>
        </div>
        {batch.status === 'confirmed' && (
          <Button className="secondary" disabled={busy} onClick={() => void reverse()}>
            Desfazer importação
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <label>
        Buscar no relatório
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Descrição, data ou ID externo"
        />
      </label>
      <div className="panel review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th>Usar</th>
              <th>Data / evento</th>
              <th>Tipo financeiro</th>
              <th>Valor líquido</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(page * 25, (page + 1) * 25).map((item) => (
              <ImportReviewRow
                key={item.id}
                item={item}
                disabled
                categories={categories.data ?? []}
                onReview={async () => {}}
              />
            ))}
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
  );
}
