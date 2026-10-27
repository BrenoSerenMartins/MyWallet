import { useState } from 'react';
import type { Category, Counterparty } from '../../../shared/api/resources';
import { CategorySelect } from '../../../shared/ui/category-select';
import { Button } from '../../../shared/ui/primitives';
export function ClassificationRuleEditor({
  rule,
  categories,
  busy,
  onChange,
}: {
  rule: Counterparty['rules'][number];
  categories: Category[];
  busy: boolean;
  onChange: (enabled: boolean, categoryId?: string) => void;
}) {
  const [categoryId, setCategory] = useState(rule.categoryId);
  return (
    <div className="form-grid">
      <label>
        Categoria da regra
        <CategorySelect
          categories={categories}
          type={rule.transactionType}
          value={categoryId}
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <Button
          className="secondary compact"
          disabled={busy || !categoryId || categoryId === rule.categoryId}
          onClick={() => onChange(rule.enabled, categoryId)}
        >
          Aplicar categoria ao histórico
        </Button>
        <Button
          className="secondary compact"
          disabled={busy}
          onClick={() => onChange(!rule.enabled)}
        >
          {rule.enabled ? 'Desativar regra' : 'Ativar regra'}
        </Button>
      </div>
    </div>
  );
}
