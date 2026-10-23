import { ReprocessImport } from './reprocess-import';
import { ImportSourceSummary } from './import-source-summary';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { ImportReviewRow } from './import-review-row';
import { useState } from 'react';
import { OpeningPositionReview } from './opening-position-review';
import { useImportReview } from '../hooks/use-import-review';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImportBatch } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
export function ImportReview({
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
    selected,
    unresolved,
    review,
    confirm,
    classify,
    reverse,
    retainHistory,
    reopenHistory,
  } = useImportReview(batch, refresh);
  const canIntegrate = batch.canIntegrate !== false;
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');
  const duplicates = batch.items.filter((item) => item.duplicateLocked);
  const pending = batch.items.filter(
    (item) =>
      !item.duplicateLocked &&
      (item.transactionType === 'unclassified' || (item.duplicateCandidate && !item.selected)),
  );
  const ready = batch.items.filter(
    (item) => item.selected && item.transactionType !== 'unclassified' && !item.duplicateLocked,
  );
  const items = batch.items
    .filter(
      (item) =>
        view === 'all' ||
        (view === 'duplicates'
          ? item.duplicateLocked
          : view === 'pending'
            ? pending.includes(item)
            : ready.includes(item)),
    )
    .filter((item) =>
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
          setView('all');
          setSearch('');
        }}
      />
      <ImportSourceSummary batch={batch} />
      {batch.status === 'draft' &&
        canIntegrate &&
        (batch.openingMismatch || batch.openingDateMismatch) && (
          <OpeningPositionReview batch={batch} refresh={refresh} />
        )}
      {canIntegrate && duplicates.length > 0 && (
        <div className="review-banner duplicate-banner" role="status">
          <div>
            <strong>
              {duplicates.length}{' '}
              {duplicates.length === 1
                ? 'duplicata excluída automaticamente'
                : 'duplicatas excluídas automaticamente'}
            </strong>
            <p>
              Não entram no saldo e não podem ser selecionadas. A verificação será repetida antes de
              salvar, inclusive entre arquivos do mesmo lote.
            </p>
          </div>
        </div>
      )}
      {!canIntegrate && (
        <div className="review-banner">
          <div>
            <strong>Liquidações · somente para consulta</strong>
            <p>
              Este relatório informa eventos e valores líquidos, mas não fornece saldos para
              conciliação. Ele não cria lançamentos nem altera gastos, patrimônio ou planejamento.
              Use um extrato de conta para integrar os movimentos.
            </p>
          </div>
        </div>
      )}
      {batch.status === 'draft' && (
        <details
          className="secondary-disclosure"
          open={!canIntegrate || batch.openingMismatch || batch.openingDateMismatch || undefined}
        >
          <summary>Guardar apenas para consulta</summary>
          <div className="review-banner">
            <div>
              <strong>Quer manter este extrato apenas para consulta?</strong>
              <p>
                Guarda os movimentos do arquivo sem mudar saldos, gastos ou planejamento. O arquivo
                original não é armazenado.
              </p>
            </div>
            <Button
              className="secondary"
              disabled={busy || !navigator.onLine}
              onClick={() => void retainHistory()}
            >
              Salvar apenas como histórico
            </Button>
          </div>
        </details>
      )}
      {batch.status === 'history' && (
        <div className="review-banner">
          <div>
            <strong>Histórico para consulta · não afeta seus saldos</strong>
            <p>
              Estes movimentos ficam separados dos lançamentos financeiros. Confira datas e
              descrição na busca abaixo.
            </p>
          </div>
          {canIntegrate && (
            <Button
              className="secondary"
              disabled={busy || !navigator.onLine}
              onClick={() => void reopenHistory()}
            >
              Revisar para integrar às contas
            </Button>
          )}
        </div>
      )}
      {batch.status === 'draft' && canIntegrate ? (
        <div className="review-banner">
          <div>
            <strong>
              {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'} ·{' '}
              {unresolved} a classificar
            </strong>
            <p>
              Entradas e saídas já foram classificadas pelo valor. Reservas reconhecidas são
              transferências. Confira as categorias e transferências entre suas próprias contas.
            </p>
          </div>
          {unresolved > 0 && (
            <Button className="secondary" disabled={busy} onClick={() => void classify()}>
              Classificar entradas e saídas
            </Button>
          )}
        </div>
      ) : batch.status !== 'draft' ? (
        <div className="review-banner">
          <strong>
            {batch.status === 'confirmed'
              ? 'Revisão concluída. Somente movimentos novos foram adicionados.'
              : batch.status === 'history'
                ? 'Extrato salvo apenas para consulta.'
                : 'Importação desfeita.'}
          </strong>
          {batch.status === 'confirmed' && (
            <Button className="secondary" disabled={busy} onClick={() => void reverse()}>
              Desfazer importação
            </Button>
          )}
        </div>
      ) : null}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {categories.isError && (
        <p className="field-help" role="alert">
          Não foi possível carregar suas categorias. Tente atualizar a página antes de categorizar.
        </p>
      )}
      {canIntegrate && (
        <div className="review-views">
          <ViewSwitcher
            label="Revisar movimentos"
            value={view}
            onChange={(value) => {
              setView(value);
              setPage(0);
            }}
            options={[
              { value: 'all', label: 'Todos', count: batch.items.length },
              { value: 'pending', label: 'Pendências', count: pending.length },
              { value: 'ready', label: 'Prontos', count: ready.length },
              { value: 'duplicates', label: 'Duplicatas', count: duplicates.length },
            ]}
          />
        </div>
      )}
      <label className="import-search">
        Buscar no extrato
        <input
          type="search"
          value={search}
          placeholder="Descrição, data (AAAA-MM-DD) ou referência"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </label>
      {!items.length && (
        <p className="field-help" role="status">
          Nenhum movimento encontrado para esta busca.
        </p>
      )}
      <div className="panel review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th>Usar</th>
              <th>Data / descrição</th>
              <th>Tipo financeiro</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(page * 25, (page + 1) * 25).map((item) => (
              <ImportReviewRow
                key={item.id}
                item={item}
                disabled={busy || batch.status !== 'draft' || !canIntegrate}
                categories={categories.data ?? []}
                onReview={review}
              />
            ))}
          </tbody>
        </table>
        <div className="review-pagination">
          <span>
            Página {page + 1} de {Math.max(1, Math.ceil(items.length / 25))}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Página anterior"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Próxima página"
              disabled={(page + 1) * 25 >= items.length}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
      </div>
      {batch.status === 'draft' && canIntegrate && (
        <div className="review-confirm">
          <p>
            {batch.items.some((item) => !item.selected && !item.duplicateLocked)
              ? 'Movimentos desmarcados não serão adicionados. Confira suas escolhas antes de confirmar.'
              : 'Confira a classificação e as categorias. As duplicatas identificadas não serão adicionadas.'}
          </p>
          <Button
            disabled={
              busy ||
              !!unresolved ||
              (!selected.length && !duplicates.length) ||
              (!!selected.length && (batch.openingMismatch || batch.openingDateMismatch)) ||
              !navigator.onLine
            }
            onClick={() => void confirm()}
          >
            {busy
              ? 'Aguarde…'
              : selected.length
                ? `Confirmar ${selected.length} ${selected.length === 1 ? 'movimento' : 'movimentos'}`
                : 'Concluir sem novos lançamentos'}
            <CheckCircle2 size={18} />
          </Button>
        </div>
      )}
    </>
  );
}
