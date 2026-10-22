import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers3, Check } from 'lucide-react';
import type { Workspace } from '../../../shared/api/resources';
export function WorkspaceCard({
  workspace,
  active,
  onSelect,
}: {
  workspace: Workspace;
  active: boolean;
  onSelect: () => void;
}) {
  return (
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
          {workspace.isDefault && <span className="space-kind">Pessoal</span>}
        </div>
        <p>{workspace.description || 'Um novo espaço para organizar suas finanças.'}</p>
        <span className="space-card-footer">
          Abrir espaço <ArrowUpRight size={15} />
        </span>
      </div>
    </Link>
  );
}
