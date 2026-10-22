import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../workspace-provider';
import { Button } from '../../../shared/ui/primitives';
const colors = [
  { value: 'emerald', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'violet', label: 'Violeta' },
  { value: 'amber', label: 'Âmbar' },
  { value: 'rose', label: 'Rosa' },
];
export function CreateWorkspaceForm() {
  const { create } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('emerald');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await create({ name: name.trim(), description, color });
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o espaço.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Nome do espaço
        <input
          required
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Casa, meu negócio, viagem…"
        />
      </label>
      <label>
        Descrição <span className="muted">Opcional</span>
        <textarea
          rows={3}
          maxLength={240}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Para que você quer usar este espaço?"
        />
      </label>
      <fieldset className="space-color-field">
        <legend>Cor do espaço</legend>
        <div className="space-colors">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              aria-pressed={color === c.value}
              className={`space-color space-${c.value}`}
              onClick={() => setColor(c.value)}
            >
              {color === c.value && <Check size={18} />}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy || !name.trim() || !navigator.onLine}>
        {busy ? 'Criando espaço…' : 'Criar e abrir espaço'}
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}
