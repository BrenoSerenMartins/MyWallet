import { useState } from 'react';
import type { Category, ImportItem } from '../../../shared/api/resources';
import { CategorySelect } from '../../../shared/ui/category-select';
import { Button } from '../../../shared/ui/primitives';
export function ImportBulkReview({
  items,
  categories,
  disabled,
  onReview,
}: {
  items: ImportItem[];
  categories: Category[];
  disabled: boolean;
  onReview: (
    ids: string[],
    change: { action: 'selection'; selected: boolean } | { action: 'category'; categoryId: string },
  ) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState('');
  const editable = items.filter(
    (item) => item.action === 'create' && !item.duplicateLocked && !item.refundOfId,
  );
  const category = categories.find((item) => item.id === categoryId);
  const targets = editable.filter((item) => item.transactionType === category?.type);
  if (!editable.length) return null;
  return (
    <details className="import-bulk panel">
      <summary>Revisar em lote · {editable.length} novos movimentos visíveis</summary>
      <p className="field-help">
        As ações abaixo valem somente para os movimentos novos desta página, respeitando a busca e a
        aba. Duplicatas, vínculos e devoluções ficam protegidos.
      </p>
      <div className="bulk-selection">
        <Button
          className="secondary"
          disabled={disabled}
          onClick={() =>
            void onReview(
              editable.map((item) => item.id),
              { action: 'selection', selected: true },
            )
          }
        >
          Selecionar {editable.length} visíveis
        </Button>
        <Button
          className="secondary"
          disabled={disabled}
          onClick={() =>
            void onReview(
              editable.map((item) => item.id),
              { action: 'selection', selected: false },
            )
          }
        >
          Desmarcar {editable.length} visíveis
        </Button>
      </div>
      <label>
        Categoria para o lote
        <CategorySelect
          aria-label="Categoria do lote"
          categories={categories}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          emptyLabel="Escolha uma categoria"
          disabled={disabled}
        />
      </label>
      <p className="field-help">
        {category
          ? `${targets.length} ${category.type === 'expense' ? 'despesas' : 'receitas'} visíveis receberão esta categoria. Não serão criadas regras automáticas.`
          : 'Escolha a categoria para conferir quantos movimentos serão alterados.'}
      </p>
      <Button
        disabled={disabled || !targets.length}
        onClick={() => {
          if (
            window.confirm(
              `Aplicar ${category?.name} a ${targets.length} movimentos desta página? Nenhuma regra automática será criada.`,
            )
          )
            void onReview(
              targets.map((item) => item.id),
              { action: 'category', categoryId },
            );
        }}
      >
        Aplicar a {targets.length} movimentos
      </Button>
    </details>
  );
}
