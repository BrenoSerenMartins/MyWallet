import { useState, type FormEvent } from 'react';
import type { Category, CategoryGroup } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
const defaultColors: Record<string, string> = { expense: '#f28a97', income: '#5ee9b5' };
export function CategoryForm({
  kind,
  entry,
  initialGroup,
  initialType,
  groups,
  onSave,
}: {
  kind: 'category' | 'group';
  initialType: 'income' | 'expense';
  entry?: Category | CategoryGroup;
  initialGroup?: CategoryGroup;
  groups: CategoryGroup[];
  onSave: (input: {
    name: string;
    type: string;
    color: string;
    groupId?: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(entry?.name ?? '');
  const [type, setType] = useState(entry?.type ?? initialGroup?.type ?? initialType);
  const [color, setColor] = useState(entry?.color ?? defaultColors[type]);
  const [customColor, setCustomColor] = useState(
    !!entry && entry.color.toLowerCase() !== defaultColors[type],
  );
  const [groupId, setGroupId] = useState(
    (entry && 'groupId' in entry ? entry.groupId : initialGroup?.id) ??
      groups.find((group) => group.isDefault && group.type === type)?.id ??
      '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        type,
        color,
        ...(kind === 'category' ? { groupId: groupId || null } : {}),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Nome
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'group' ? 'Ex.: Casa ou Alimentação' : 'Ex.: Luz ou Mercado'}
        />
      </label>
      <label>
        Tipo
        <select
          value={type}
          disabled={!!entry}
          onChange={(e) => {
            if (!customColor) setColor(defaultColors[e.target.value]);
            setType(e.target.value);
            setGroupId(
              groups.find((group) => group.isDefault && group.type === e.target.value)?.id ?? '',
            );
          }}
        >
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
      </label>
      {kind === 'category' && (
        <label>
          Grupo
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {!groups.some((group) => group.isDefault && group.type === type) && (
              <option value="">Grupo padrão</option>
            )}
            {groups
              .filter((g) => g.type === type)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        Cor
        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setCustomColor(true);
          }}
        />
      </label>
      <div className="category-color-actions">
        <span className="field-help">
          {type === 'expense' ? 'Padrão de despesa: vermelho.' : 'Padrão de receita: verde.'}
        </span>
        <button
          type="button"
          className="text-button"
          disabled={busy || color.toLowerCase() === defaultColors[type]}
          onClick={() => {
            setColor(defaultColors[type]);
            setCustomColor(false);
          }}
        >
          Restaurar cor padrão
        </button>
      </div>
      <p className="field-help">
        {kind === 'group'
          ? 'Agrupe categorias do mesmo tipo. Os lançamentos ficam nas categorias, como Casa → Luz.'
          : 'Você pode mudar o grupo depois. Seus lançamentos e valores planejados serão preservados.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy || !navigator.onLine}>
        {busy
          ? 'Salvando…'
          : entry
            ? 'Salvar alterações'
            : kind === 'group'
              ? 'Criar grupo'
              : 'Criar categoria'}
      </Button>
    </form>
  );
}
