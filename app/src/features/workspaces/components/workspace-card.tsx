import { Link } from 'react-router-dom';
import { Layers3, Check, Trash2 } from 'lucide-react';
import { IconAction } from '../../../shared/ui/icon-action';
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
    <article className={`space-card-container space-entry space-${workspace.color}`}>
      <Link
        to="/"
        onClick={onSelect}
        className={`space-card ${active ? 'space-card-active' : ''}`}
        aria-label={`Abrir espaço ${workspace.name}`}
      >
        <span className="space-card-symbol" aria-hidden="true">
          <Layers3 size={24} />
        </span>
        <div className="space-entry-copy">
          <h2>{workspace.name}</h2>
          <div className="space-entry-status">
            {active && (
              <span className="space-entry-current">
                <Check size={13} aria-hidden="true" />
                Em uso
              </span>
            )}
            {workspace.isDefault && <span>Padrão</span>}
          </div>
          {workspace.description && <p>{workspace.description}</p>}
        </div>
      </Link>
      <IconAction
        label={`Excluir espaço ${workspace.name}`}
        className="space-delete-action"
        icon={<Trash2 size={17} />}
        onClick={onDelete}
        disabled={!navigator.onLine}
      />
    </article>
  );
}
