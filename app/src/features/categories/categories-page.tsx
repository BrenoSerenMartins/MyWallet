import { DeleteCategoryDialog } from './components/delete-category-dialog';
import { CategoryGroupPanel } from './components/category-group-panel';
import { DeleteGroupDialog } from './components/delete-group-dialog';
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
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
  const { categories, groups, save, deleteGroup, deleteCategory } = useCategories();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<CategoryGroup | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const matching = (categories.data ?? []).filter(
    (c) =>
      c.type === type &&
      `${c.groupName ?? ''} ${c.name}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const visibleGroups = (groups.data ?? [])
    .filter((group) => group.type === type)
    .sort(
      (a, b) =>
        Number(!!b.isDefault) - Number(!!a.isDefault) || a.name.localeCompare(b.name, 'pt-BR'),
    );
  const activeGroup = visibleGroups.find((group) => group.id === selectedGroup) ?? visibleGroups[0];
  return (
    <div className="page-enter categories-page" data-financial-type={type}>
      <div className="page-heading">
        <div>
          <h1>Categorias</h1>
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
          onChange={(value) => {
            setType(value);
            setSelectedGroup('');
            setSearch('');
          }}
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
      </div>
      {categories.isError || groups.isError ? (
        <ErrorState error={categories.error ?? groups.error} />
      ) : categories.isPending || groups.isPending ? (
        <Loading />
      ) : !visibleGroups.length ? (
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
        <>
          <div
            className="category-group-tabs"
            role="tablist"
            aria-label="Grupos de categorias"
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const focused = (event.target as HTMLElement).closest('[role=tab]')?.id;
              const index = visibleGroups.findIndex((group) => `group-tab-${group.id}` === focused);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? visibleGroups.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleGroups.length) %
                      visibleGroups.length;
              setSelectedGroup(visibleGroups[next].id);
              document.getElementById(`group-tab-${visibleGroups[next].id}`)?.focus();
            }}
          >
            {visibleGroups.map((group) => (
              <button
                type="button"
                role="tab"
                id={`group-tab-${group.id}`}
                aria-controls="category-group-panel"
                aria-selected={group.id === activeGroup?.id}
                tabIndex={group.id === activeGroup?.id ? 0 : -1}
                key={group.id}
                onClick={() => setSelectedGroup(group.id)}
              >
                {!group.isDefault && (
                  <span className="category-group-dot" style={{ background: group.color }} />
                )}
                {group.name}
                <span className="category-tab-count">
                  {
                    (categories.data ?? []).filter((category) => category.groupId === group.id)
                      .length
                  }
                </span>
              </button>
            ))}
          </div>
          {activeGroup && (
            <CategoryGroupPanel
              group={activeGroup}
              searching={!!search}
              categories={
                search
                  ? matching
                  : matching.filter((category) => category.groupId === activeGroup.id)
              }
              onAdd={() => setEditor({ kind: 'category', group: activeGroup })}
              onEditGroup={() => setEditor({ kind: 'group', entry: activeGroup })}
              onDelete={() => setDeleting(activeGroup)}
              onEditCategory={(entry) => setEditor({ kind: 'category', entry })}
              onDeleteCategory={setDeletingCategory}
            />
          )}
        </>
      )}
      {deletingCategory && (
        <DeleteCategoryDialog
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
          onDelete={() => deleteCategory(deletingCategory.id)}
        />
      )}
      {deleting && (
        <DeleteGroupDialog
          group={deleting}
          onClose={() => setDeleting(null)}
          onDelete={() => deleteGroup(deleting.id)}
        />
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
              if (editor.kind === 'group' && !editor.entry) {
                const latest = await groups.refetch();
                const created = latest.data?.find(
                  (group) => group.name === input.name && group.type === input.type,
                );
                if (created) setSelectedGroup(created.id);
              }
              setEditor(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
