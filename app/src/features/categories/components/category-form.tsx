import { useState, type FormEvent } from 'react';
import type { Category, CategoryGroup } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
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
  const [color, setColor] = useState(entry?.color ?? initialGroup?.color ?? '#5ee9b5');
  const [groupId, setGroupId] = useState(
    (entry && 'groupId' in entry ? entry.groupId : initialGroup?.id) ?? '',
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
            setType(e.target.value);
            setGroupId('');
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
            <option value="">Sem grupo</option>
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
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </label>
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
