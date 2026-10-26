import { OpeningInitialization } from './opening-initialization';
import { useState } from 'react';
import { useImportReview } from '../hooks/use-import-review';
import type { ImportBatch } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { ImportReviewRow } from './import-review-row';
import { ReprocessImport } from './reprocess-import';
export function SettlementReview({
  batch,
  refresh,
}: {
  batch: ImportBatch;
  refresh: () => Promise<unknown>;
}) {
  const {
    categories,
    page,
    setPage,
    busy,
    error,
    unresolved,
    review,
    confirm,
    retainHistory,
    reopenHistory,
    reverse,
  } = useImportReview(batch, refresh);
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const count = (action: string) => batch.items.filter((item) => item.action === action).length;
  const items = batch.items.filter(
    (item) =>
      (view === 'all' || item.action === view) &&
      `${item.description} ${item.transactionDate} ${item.sourceOperationId ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <ReprocessImport
        batch={batch}
        onProcessed={async () => {
          await refresh();
          setPage(0);
        }}
      />
      <OpeningInitialization batch={batch} />
      <div className="review-banner">
        <div>
          <strong>EDI Mercado Pago · fonte de conciliação</strong>
          <p>
            {count('create')} novos · {count('reconcile')} a conciliar · {count('recorded')} já
            registrados · {count('review')} pendências.
          </p>
          <p>
            Movimentos novos confirmados pelo EDI entram conciliados. Os existentes são vinculados
            sem duplicar valores ou substituir categorias. O saldo continua calculado a partir da
            posição inicial e dos lançamentos.
          </p>
        </div>
      </div>
      {batch.status === 'history' && (
        <div className="review-banner">
          <strong>Relatório guardado no histórico, sem confirmação financeira.</strong>
          <Button disabled={busy} onClick={() => void reopenHistory()}>
            Revisar para integrar às contas
          </Button>
        </div>
      )}
      {batch.status === 'confirmed' && (
        <div className="review-banner">
          <strong>EDI confirmado. Operações vinculadas aos lançamentos financeiros.</strong>
          <Button className="secondary" disabled={busy} onClick={() => void reverse()}>
            Desfazer importação
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ViewSwitcher
        label="Ações do EDI"
        value={view}
        onChange={(value) => {
          setView(value);
          setPage(0);
        }}
        options={[
          { value: 'all', label: 'Todos', count: batch.items.length },
          { value: 'create', label: 'Novos', count: count('create') },
          { value: 'reconcile', label: 'A conciliar', count: count('reconcile') },
          { value: 'review', label: 'Pendências', count: count('review') },
          { value: 'recorded', label: 'Já registrados', count: count('recorded') },
        ]}
      />
      <label className="import-search">
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
              <th>Data / evento / conciliação</th>
              <th>Tipo financeiro</th>
              <th>Valor líquido</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(page * 25, (page + 1) * 25).map((item) => (
              <ImportReviewRow
                key={item.id}
                item={item}
                disabled={busy || batch.status !== 'draft'}
                categories={categories.data ?? []}
                onReview={review}
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
      {batch.status === 'draft' && (
        <div className="review-confirm">
          <Button
            className="secondary"
            disabled={busy || !navigator.onLine}
            onClick={() => void retainHistory()}
          >
            Guardar apenas no histórico
          </Button>
          <Button
            disabled={
              busy ||
              !!unresolved ||
              !batch.items.some((item) => item.selected || item.duplicateLocked) ||
              !navigator.onLine
            }
            onClick={() => void confirm()}
          >
            {busy ? 'Aguarde…' : 'Confirmar EDI e conciliar'}
          </Button>
        </div>
      )}
      {unresolved > 0 && batch.status === 'draft' && (
        <p className="field-help">
          Resolva os registros pendentes antes de confirmar. Pagamentos com liberação pendente
          continuam em revisão; eventos de saldo reconhecidos entram pelo valor líquido do EDI.
        </p>
      )}
    </>
  );
}
