import { Link } from 'react-router-dom';
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
  const { page, setPage, busy, error, selected, unresolved, review, confirm, classify, reverse } =
    useImportReview(batch, refresh);
  return (
    <>
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
      {batch.status === 'draft' && batch.openingMismatch && (
        <div className="form-error" role="alert">
          <strong>A posição inicial da conta precisa de revisão.</strong>
          <p>
            Antes deste extrato, a conta registra {money(batch.recordedOpeningBalance)}, mas o
            arquivo começa em {money(batch.openingBalance)}. Ajuste o saldo inicial em Minhas
            contas, se ela ainda não tiver movimentos, ou confira os movimentos anteriores.
          </p>
          <Link className="text-button" to="/accounts">
            Revisar minhas contas
          </Link>
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
            {batch.items.slice(page * 25, (page + 1) * 25).map((item) => (
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
            Página {page + 1} de {Math.ceil(batch.items.length / 25)}
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
              disabled={(page + 1) * 25 >= batch.items.length}
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
              busy || !!unresolved || !selected.length || batch.openingMismatch || !navigator.onLine
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
