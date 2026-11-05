import { useNotifications } from '../../../shared/feedback/notification-provider';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/auth-provider';
import { request } from '../../../shared/api/client';
import type { TrashedWorkspace } from '../../../shared/api/resources';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
import { useWorkspace } from '../workspace-provider';
export function WorkspaceTrash() {
  const { session } = useAuth();
  const { restore } = useWorkspace();
  const [pending, setPending] = useState<string | null>(null);
  const {
    success: setMessage,
    error: notifyError,
    dismiss: dismissNotice,
  } = useNotifications('session');
  const query = useQuery({
    queryKey: ['workspace-trash', session!.user.id],
    queryFn: () => request<TrashedWorkspace[]>('/workspaces/trash'),
  });
  async function restoreWorkspace(workspace: TrashedWorkspace) {
    setPending(workspace.id);
    dismissNotice(`restore-workspace:${workspace.id}`);
    setMessage('');
    try {
      await restore(workspace.id);
      setMessage(`Espaço “${workspace.name}” restaurado.`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Não foi possível restaurar o espaço.', {
        id: `restore-workspace:${workspace.id}`,
      });
    } finally {
      setPending(null);
    }
  }
  return (
    <details className="workspace-trash panel">
      <summary>
        <Trash2 size={18} />
        Lixeira {query.data && <span className="badge">{query.data.length}</span>}
        <ChevronDown className="workspace-trash-toggle" size={16} aria-hidden="true" />
      </summary>
      <p>
        Espaços excluídos podem ser restaurados por 7 dias. Após o prazo, são removidos
        definitivamente, junto com seus dados.
      </p>

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
