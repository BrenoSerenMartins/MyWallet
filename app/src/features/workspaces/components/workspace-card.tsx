import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers3, Check, Trash2 } from 'lucide-react';
import type { Workspace } from '../../../shared/api/resources';
export function WorkspaceCard({
  workspace,
  active,
  onSelect,
  onDelete,
}: {
  workspace: Workspace;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="space-card-container">
      <Link
        to="/"
        onClick={onSelect}
        className={`space-card ${active ? 'space-card-active' : ''}`}
        aria-label={`Abrir espaço ${workspace.name}`}
      >
        <div className={`space-cover space-${workspace.color}`}>
          <span className="space-cover-rings" aria-hidden="true" />
          <span className="space-card-symbol">
            <Layers3 size={27} />
          </span>
          {active && (
            <span className="space-current">
              <Check size={12} />
              Em uso
            </span>
          )}
          <ArrowUpRight size={20} className="space-open-icon" />
        </div>
        <div className="space-card-body">
          <div>
            <h2>{workspace.name}</h2>
            {workspace.isDefault && <span className="space-kind">Padrão</span>}
          </div>
          <p>{workspace.description || 'Um novo espaço para organizar suas finanças.'}</p>
          <span className="space-card-footer">
            Abrir espaço <ArrowUpRight size={15} />
          </span>
        </div>
      </Link>
      <button
        type="button"
        className="space-delete-button"
        aria-label={`Excluir espaço ${workspace.name}`}
        onClick={onDelete}
        disabled={!navigator.onLine}
      >
        <Trash2 size={15} />
        Excluir
      </button>
    </article>
  );
}
