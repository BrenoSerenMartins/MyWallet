import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/auth-provider';
import { request } from '../../../shared/api/client';
import type { TrashedWorkspace } from '../../../shared/api/resources';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
import { useWorkspace } from '../workspace-provider';
export function WorkspaceTrash() {
  const { session } = useAuth();
  const { restore } = useWorkspace();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['workspace-trash', session!.user.id],
    queryFn: () => request<TrashedWorkspace[]>('/workspaces/trash'),
  });
  async function restoreWorkspace(workspace: TrashedWorkspace) {
    setPending(workspace.id);
    setError(null);
    setMessage('');
    try {
      await restore(workspace.id);
      setMessage(`Espaço “${workspace.name}” restaurado.`);
    } catch (error) {
      setError(error);
    } finally {
      setPending(null);
    }
  }
  return (
    <details className="workspace-trash panel">
      <summary>
        <Trash2 size={18} />
        Lixeira {query.data && <span className="badge">{query.data.length}</span>}
      </summary>
      <p>
        Espaços excluídos podem ser restaurados por 7 dias. Após o prazo, são removidos
        definitivamente, junto com seus dados.
      </p>
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {!!error && <ErrorState error={error} />}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <ul>
          {query.data.map((workspace) => (
            <li key={workspace.id}>
              <div>
                <strong>{workspace.name}</strong>
                <span>
                  Disponível para restaurar até{' '}
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(workspace.deleteAfter))}
                </span>
              </div>
              <Button
                className="secondary compact"
                disabled={
                  pending !== null ||
                  !navigator.onLine ||
                  Date.parse(workspace.deleteAfter) <= Date.now()
                }
                onClick={() => void restoreWorkspace(workspace)}
              >
                <RotateCcw size={16} />
                {pending === workspace.id ? 'Restaurando…' : 'Restaurar'}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum espaço na lixeira.</p>
      )}
    </details>
  );
}
