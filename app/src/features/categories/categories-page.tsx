import { CategoryGroupCard } from './components/category-group-card';
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
  const { categories, groups, save, deleteGroup } = useCategories();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<CategoryGroup | null>(null);
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
        <div className="category-groups">
          {visibleGroups.map((group) => (
            <CategoryGroupCard
              key={group.id}
              group={group}
              categories={matching.filter((category) => category.groupId === group.id)}
              searching={!!search}
              onAdd={() => setEditor({ kind: 'category', group })}
              onEditGroup={() => setEditor({ kind: 'group', entry: group })}
              onEditCategory={(entry) => setEditor({ kind: 'category', entry })}
              onDelete={() => setDeleting(group)}
            />
          ))}
        </div>
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
              setEditor(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
