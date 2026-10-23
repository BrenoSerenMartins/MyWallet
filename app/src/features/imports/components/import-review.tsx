import { useState } from 'react';
import { OpeningPositionReview } from './opening-position-review';
import { useImportReview } from '../hooks/use-import-review';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImportBatch, ImportItem } from '../../../shared/api/resources';
import { money, shortDate } from '../../../shared/formatting/money';
import { Button } from '../../../shared/ui/primitives';
export function ImportReview({
  batch,
  refresh,
}: {
  batch: ImportBatch;
  refresh: () => Promise<unknown>;
}) {
  const {
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
  const [search, setSearch] = useState('');
  const items = batch.items.filter((item) =>
    `${item.description} ${item.transactionDate} ${item.sourceOperationId ?? ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <p className="field-help">
        Formato: {batch.sourceFormat?.toUpperCase() ?? 'PDF'} · Extrato de conta Mercado Pago.
        Referências, datas e valores são preservados para revisar possíveis duplicidades entre
        formatos.
      </p>
      <section className="review-summary">
        <div className="panel">
          <span>Movimentos no arquivo</span>
          <strong>{batch.items.length}</strong>
        </div>
        <div className="panel">
          <span>Saldo inicial do extrato</span>
          <strong>{money(batch.openingBalance)}</strong>
        </div>
        <div className="panel">
          <span>Saldo final do extrato</span>
          <strong>{money(batch.closingBalance)}</strong>
        </div>
        <div className="panel">
          <span>Conferência do arquivo</span>
          <strong className="positive-text">
            <CheckCircle2 size={18} /> Saldos conferidos
          </strong>
        </div>
      </section>
      {batch.status === 'draft' && (batch.openingMismatch || batch.openingDateMismatch) && (
        <OpeningPositionReview batch={batch} refresh={refresh} />
      )}
      {batch.status === 'draft' && (
        <div className="review-banner">
          <div>
            <strong>Quer manter este extrato apenas para consulta?</strong>
            <p>
              Guarda os movimentos do arquivo sem mudar saldos, gastos ou planejamento. O PDF
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
          <Button
            className="secondary"
            disabled={busy || !navigator.onLine}
            onClick={() => void reopenHistory()}
          >
            Revisar para integrar às contas
          </Button>
        </div>
      )}
      {batch.status === 'draft' ? (
        <div className="review-banner">
          <div>
            <strong>
              {selected.length} selecionados · {unresolved} a classificar
            </strong>
            <p>
              Reservas são transferências. Desmarque movimentos já registrados e confira a
              classificação.
            </p>
          </div>
          {unresolved > 0 && (
            <Button className="secondary" disabled={busy} onClick={() => void classify()}>
              Classificar entradas e saídas
            </Button>
          )}
        </div>
      ) : (
        <div className="review-banner">
          <strong>
            {batch.status === 'confirmed'
              ? 'Importação confirmada. Seus movimentos já estão no saldo.'
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
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
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
              <tr key={item.id} className={!item.selected ? 'excluded' : ''}>
                <td>
                  <input
                    aria-label={`Selecionar movimento ${item.sourceRow}`}
                    type="checkbox"
                    checked={item.selected}
                    disabled={busy || batch.status !== 'draft'}
                    onChange={(e) => void review(item, { selected: e.target.checked })}
                  />
                </td>
                <td>
                  <span className="review-date">{shortDate(item.transactionDate)}</span>
                  <strong>{item.description}</strong>
                  {item.duplicateCandidate && (
                    <span className="badge warning">Possível duplicidade</span>
                  )}
                </td>
                <td>
                  <select
                    aria-label={`Tipo do movimento ${item.sourceRow}`}
                    value={item.transactionType}
                    disabled={busy || batch.status !== 'draft'}
                    onChange={(e) =>
                      void review(item, {
                        transactionType: e.target.value as ImportItem['transactionType'],
                      })
                    }
                  >
                    <option value="unclassified">A revisar</option>
                    {item.amount > 0 ? (
                      <option value="income">Receita</option>
                    ) : (
                      <option value="expense">Despesa</option>
                    )}
                    <option value="transfer">Transferência</option>
                  </select>
                </td>
                <td className="numeric">{money(item.amount)}</td>
              </tr>
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
      {batch.status === 'draft' && (
        <div className="review-confirm">
          <p>
            {selected.length !== batch.items.length
              ? 'O saldo da conta pode diferir do extrato quando você exclui movimentos.'
              : 'Confira a posição inicial da conta e os movimentos antes de confirmar.'}
          </p>
          <Button
            disabled={
              busy ||
              !!unresolved ||
              !selected.length ||
              batch.openingMismatch ||
              batch.openingDateMismatch ||
              !navigator.onLine
            }
            onClick={() => void confirm()}
          >
            {busy ? 'Aguarde…' : `Confirmar ${selected.length} movimentos`}
            <CheckCircle2 size={18} />
          </Button>
        </div>
      )}
    </>
  );
}
