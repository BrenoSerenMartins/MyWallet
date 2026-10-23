import type { ImportItem, Category } from '../../../shared/api/resources';
import { CategorySelect } from '../../../shared/ui/category-select';
import { money, shortDate } from '../../../shared/formatting/money';
import { SettlementDetails } from './settlement-details';
export function ImportReviewRow({
  item,
  disabled,
  categories,
  onReview,
}: {
  item: ImportItem;
  disabled: boolean;
  categories: Category[];
  onReview: (
    item: ImportItem,
    change: Partial<Pick<ImportItem, 'selected' | 'transactionType' | 'categoryId'>>,
  ) => Promise<void>;
}) {
  const locked = disabled || item.duplicateLocked;
  return (
    <tr className={item.duplicateLocked ? 'duplicate-row' : !item.selected ? 'excluded' : ''}>
      <td data-label="Incluir">
        <input
          aria-label={`Selecionar movimento ${item.sourceRow}`}
          type="checkbox"
          checked={item.selected}
          disabled={locked}
          onChange={(e) => void onReview(item, { selected: e.target.checked })}
        />
      </td>
      <td data-label="Movimento">
        <span className="review-date">{shortDate(item.transactionDate)}</span>
        <strong>{item.description}</strong>
        {item.duplicateLocked ? (
          <span className="badge">
            Duplicata bloqueada ·{' '}
            {item.duplicateReason === 'same_statement' ? 'repetida no arquivo' : 'já registrada'}
          </span>
        ) : (
          item.duplicateCandidate && (
            <span className="badge warning">Semelhança encontrada · confira a origem</span>
          )
        )}
        <details className="movement-details">
          <summary>Referência e detalhes</summary>
          <p>
            Referência: {item.sourceOperationId ?? 'Não informada'} · Linha {item.sourceRow}
          </p>
        </details>
        <SettlementDetails metadata={item.metadata} />
      </td>
      <td data-label="Classificação">
        <select
          aria-label={`Tipo do movimento ${item.sourceRow}`}
          value={item.transactionType}
          disabled={locked}
          onChange={(e) =>
            void onReview(item, {
              transactionType: e.target.value as ImportItem['transactionType'],
              categoryId: null,
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
        {['income', 'expense'].includes(item.transactionType) && (
          <CategorySelect
            aria-label={`Categoria do movimento ${item.sourceRow}`}
            categories={categories}
            type={item.transactionType}
            value={item.categoryId ?? ''}
            disabled={locked}
            onChange={(e) => void onReview(item, { categoryId: e.target.value || null })}
          />
        )}
      </td>
      <td data-label="Valor" className="numeric">
        {money(item.amount)}
      </td>
    </tr>
  );
}
