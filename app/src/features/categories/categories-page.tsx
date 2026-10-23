import { useState } from 'react';
import { FolderOpen, Plus, Search, Pencil, ChevronDown } from 'lucide-react';
import type { Category, CategoryGroup } from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { useCategories } from './hooks/use-categories';
import { CategoryForm } from './components/category-form';
import './categories.css';
interface Editor {
  kind: 'category' | 'group';
  entry?: Category | CategoryGroup;
  group?: CategoryGroup;
}
export function CategoriesPage() {
  const { categories, groups, save } = useCategories();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const matching = (categories.data ?? []).filter(
    (c) =>
      c.type === type &&
      `${c.groupName ?? ''} ${c.name}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const visibleGroups = (groups.data ?? []).filter(
    (g) =>
      g.type === type &&
      (!search ||
        g.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) ||
        matching.some((c) => c.groupId === g.id)),
  );
  const sections: (CategoryGroup | null)[] = [
    ...visibleGroups,
    ...(matching.some((c) => !c.groupId) ? [null] : []),
  ];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA GASTO NO SEU LUGAR</span>
          <h1>Grupos e categorias</h1>
          <p>Casa, alimentação, lazer… organize do seu jeito, sem perder o detalhe.</p>
        </div>
        <Button onClick={() => setEditor({ kind: 'group' })}>
          <Plus size={18} />
          Novo grupo
        </Button>
      </div>
      <div className="category-toolbar">
        <ViewSwitcher
          label="Tipo de categoria"
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Despesas' },
            { value: 'income', label: 'Receitas' },
          ]}
        />
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar grupos e categorias"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar grupo ou categoria…"
          />
        </label>
        <Button className="secondary" onClick={() => setEditor({ kind: 'category' })}>
          Nova categoria
        </Button>
      </div>
      {categories.isError || groups.isError ? (
        <ErrorState error={categories.error ?? groups.error} />
      ) : categories.isPending || groups.isPending ? (
        <Loading />
      ) : !sections.length ? (
        <EmptyState
          title={search ? 'Nenhum resultado' : 'Comece pelos grandes grupos'}
          action={
            !search && (
              <Button onClick={() => setEditor({ kind: 'group' })}>Criar primeiro grupo</Button>
            )
          }
        >
          {search
            ? 'Tente outro nome.'
            : 'Crie Casa e adicione Luz, Água e Aluguel. Depois crie Alimentação com Mercado e Comer fora.'}
        </EmptyState>
      ) : (
        <div className="category-groups">
          {sections.map((group) => {
            const children = matching.filter((c) => (c.groupId ?? null) === (group?.id ?? null));
            return (
              <section className="panel category-group" key={group?.id ?? 'ungrouped'}>
                <details open={search ? true : undefined}>
                  <summary>
                    <span className="category-group-icon" style={{ color: group?.color }}>
                      <FolderOpen size={21} />
                    </span>
                    <span>
                      <strong>{group?.name ?? 'Sem grupo'}</strong>
                      <small>
                        {children.length} {children.length === 1 ? 'categoria' : 'categorias'}
                        {!group ? ' · organize as categorias anteriores' : ''}
                      </small>
                    </span>
                    <ChevronDown className="disclosure-chevron" size={18} />
                  </summary>
                  <div className="category-children">
                    {children.map((category) => (
                      <div className="category-child" key={category.id}>
                        <span className="category-color" style={{ background: category.color }} />
                        <strong>{category.name}</strong>
                        <button
                          className="icon-button"
                          aria-label={`Editar categoria ${category.name}`}
                          onClick={() => setEditor({ kind: 'category', entry: category })}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    ))}
                    {!children.length && (
                      <p className="field-help">Este grupo ainda não tem categorias.</p>
                    )}
                  </div>
                </details>
                <div className="category-group-actions">
                  <button
                    className="text-button"
                    onClick={() => setEditor({ kind: 'category', group: group ?? undefined })}
                  >
                    <Plus size={15} />
                    Adicionar categoria
                  </button>
                  {group && (
                    <button
                      className="text-button"
                      onClick={() => setEditor({ kind: 'group', entry: group })}
                    >
                      Editar grupo
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Modal
        open={!!editor}
        onOpenChange={(open) => !open && setEditor(null)}
        title={
          editor?.entry
            ? `Editar ${editor.kind === 'group' ? 'grupo' : 'categoria'}`
            : editor?.kind === 'group'
              ? 'Novo grupo'
              : 'Nova categoria'
        }
      >
        {editor && (
          <CategoryForm
            key={`${editor.kind}-${editor.entry?.id ?? editor.group?.id ?? 'new'}`}
            kind={editor.kind}
            initialType={type}
            entry={editor.entry}
            initialGroup={editor.group}
            groups={groups.data ?? []}
            onSave={async (input) => {
              await save(editor.kind, input, editor.entry?.id);
              setEditor(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
