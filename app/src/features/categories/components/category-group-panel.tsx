import { Tooltip } from '../../../shared/ui/tooltip';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryGroup } from '../../../shared/api/resources';
import { Button, EmptyState } from '../../../shared/ui/primitives';
export function CategoryGroupPanel({
  group,
  categories,
  searching,
  onAdd,
  onEditGroup,
  onDelete,
  onEditCategory,
  onDeleteCategory,
}: {
  group: CategoryGroup;
  categories: Category[];
  searching: boolean;
  onAdd: () => void;
  onEditGroup: () => void;
  onDelete: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
}) {
  return (
    <section
      className="panel category-group-panel"
      role="tabpanel"
      id="category-group-panel"
      aria-labelledby={`group-tab-${group.id}`}
    >
      <header className="category-list-heading">
        <div>
          <h2>{searching ? 'Resultados da busca' : group.name}</h2>
          <span>
            {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
          </span>
          {!searching && group.isDefault && <span className="default-label">Padrão</span>}
        </div>
        <div className="category-list-actions">
          {!searching && !group.isDefault && (
            <>
              <Tooltip text={`Editar grupo ${group.name}`}>
                <button
                  className="icon-button"
                  aria-label={`Editar grupo ${group.name}`}
                  onClick={onEditGroup}
                >
                  <Pencil size={17} />
                </button>
              </Tooltip>
              <Tooltip text={`Excluir grupo ${group.name}`}>
                <button
                  className="icon-button"
                  aria-label={`Excluir grupo ${group.name}`}
                  onClick={onDelete}
                >
                  <Trash2 size={17} />
                </button>
              </Tooltip>
            </>
          )}
          <Button className="secondary compact" onClick={onAdd}>
            <Plus size={16} />
            Adicionar categoria
          </Button>
        </div>
      </header>
      <div className="category-rows">
        {categories.map((category) => (
          <div className="category-row" key={category.id}>
            <span className="category-type-dot" />
            <button
              type="button"
              className="category-row-name"
              aria-label={`Editar categoria ${category.name}`}
              onClick={() => onEditCategory(category)}
            >
              <strong>{category.name}</strong>
              {searching && <small>{category.groupName}</small>}
            </button>

            <Tooltip text={`Excluir categoria ${category.name}`}>
              <button
                type="button"
                className="icon-button"
                aria-label={`Excluir categoria ${category.name}`}
                onClick={() => onDeleteCategory(category)}
              >
                <Trash2 size={16} />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
      {!categories.length && (
        <EmptyState
          compact
          icon={<Plus size={24} />}
          title={searching ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria neste grupo'}
        >
          {searching
            ? 'Experimente outro nome na busca.'
            : 'Use Adicionar categoria para organizar este grupo.'}
        </EmptyState>
      )}
    </section>
  );
}
