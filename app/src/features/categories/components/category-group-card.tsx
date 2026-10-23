import { useState } from 'react';
import { ChevronDown, FolderOpen, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { Category, CategoryGroup } from '../../../shared/api/resources';
export function CategoryGroupCard({
  group,
  categories,
  searching,
  onAdd,
  onEditGroup,
  onEditCategory,
  onDelete,
}: {
  group: CategoryGroup;
  categories: Category[];
  searching: boolean;
  onAdd: () => void;
  onEditGroup: () => void;
  onEditCategory: (category: Category) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const open = expanded || searching;
  return (
    <section
      className={`panel category-group ${group.isDefault ? 'default-group' : ''}`}
      aria-label={`Grupo ${group.name}`}
    >
      <header className="category-group-heading">
        <span className="category-group-icon" style={{ color: group.color }}>
          {group.isDefault ? <ShieldCheck size={23} /> : <FolderOpen size={23} />}
        </span>
        <div>
          <h2>{group.name}</h2>
          <p>
            {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
            {group.isDefault && <span className="default-label">Padrão</span>}
          </p>
        </div>
        {!group.isDefault && (
          <div className="category-group-menu">
            <button
              className="icon-button"
              title={`Editar grupo ${group.name}`}
              aria-label={`Editar grupo ${group.name}`}
              onClick={onEditGroup}
            >
              <Pencil size={17} />
            </button>
            <button
              className="icon-button"
              title={`Excluir grupo ${group.name}`}
              aria-label={`Excluir grupo ${group.name}`}
              onClick={onDelete}
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </header>
      {group.isDefault && (
        <p className="default-group-note">
          O lugar das categorias que você ainda não organizou. Este grupo fica sempre disponível.
        </p>
      )}
      <div
        hidden={open && categories.length > 0}
        className="category-preview"
        aria-label={`Categorias de ${group.name}`}
      >
        {categories.slice(0, 4).map((category) => (
          <button
            type="button"
            className="category-preview-chip"
            key={category.id}
            aria-label={`Editar categoria ${category.name}`}
            onClick={() => onEditCategory(category)}
          >
            <span className="category-color" style={{ background: category.color }} />
            {category.name}
          </button>
        ))}
        {categories.length > 4 && (
          <span className="category-preview-more">+{categories.length - 4}</span>
        )}
        {!categories.length && (
          <p className="field-help">Adicione categorias como Luz, Água ou Mercado.</p>
        )}
      </div>
      {categories.length > 0 && (
        <>
          <button
            type="button"
            className="category-expand"
            aria-expanded={open}
            onClick={() => setExpanded(!expanded)}
          >
            {' '}
            {open ? 'Recolher categorias' : 'Organizar categorias'}
            <ChevronDown size={17} className={open ? 'expanded' : ''} />
          </button>
          {open && (
            <div className="category-children">
              {categories.map((category) => (
                <div className="category-child" key={category.id}>
                  <span className="category-color" style={{ background: category.color }} />
                  <strong>{category.name}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onEditCategory(category)}
                  >
                    Editar / mover
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <footer className="category-group-actions">
        <button type="button" className="text-button" onClick={onAdd}>
          <Plus size={16} />
          Adicionar categoria
        </button>
      </footer>
    </section>
  );
}
