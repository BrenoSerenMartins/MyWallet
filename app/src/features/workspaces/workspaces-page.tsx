import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Layers3, LogOut, Plus, ShieldCheck } from 'lucide-react';
import {
  Logo,
  ThemeSwitcher,
  Button,
  Loading,
  ErrorState,
  Modal,
} from '../../shared/ui/primitives';
import { authClient } from '../../shared/api/auth-client';
import { useWorkspace } from './workspace-provider';
import type { Workspace } from '../../shared/api/resources';
import { WorkspaceTrash } from './components/workspace-trash';
import { WorkspaceCard } from './components/workspace-card';
import { CreateWorkspaceForm } from './components/create-workspace-form';
import './workspaces.css';
export function WorkspacesPage() {
  const { workspaces, active, loading, error, reload, select, archive } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  async function deleteWorkspace() {
    if (!deleting) return;
    setPending(true);
    setDeleteError(null);
    try {
      await archive(deleting.id);
      setMessage(`Espaço “${deleting.name}” movido para a lixeira por 7 dias.`);
      setDeleting(null);
    } catch (error) {
      setDeleteError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="spaces-page">
      <header className="spaces-topbar">
        <Logo />
        <div>
          {active && (
            <Link className="space-back" to="/">
              <ArrowLeft size={16} />
              Voltar ao espaço
            </Link>
          )}
          <ThemeSwitcher />
          <button
            className="icon-button"
            aria-label="Sair da conta"
            onClick={() => void authClient.auth.signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main id="main-content" className="spaces-main">
        <div className="spaces-heading">
          <div>
            <span className="eyebrow">
              <span className="status-dot" />
              CADA PLANO TEM SEU LUGAR
            </span>
            <h1>
              Seus espaços<span>.</span>
            </h1>
            <p>Escolha onde quer cuidar das suas finanças hoje.</p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={loading || !!error || !navigator.onLine}>
            <Plus size={17} />
            Criar espaço
          </Button>
        </div>
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : (
          <div className="spaces-grid">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                active={active?.id === workspace.id}
                onSelect={() => select(workspace.id)}
                onDelete={() => {
                  setDeleteError(null);
                  setDeleting(workspace);
                }}
              />
            ))}
            <button
              className="space-create-card"
              onClick={() => setOpen(true)}
              disabled={!navigator.onLine}
            >
              <span>
                <Plus size={25} />
              </span>
              <strong>Um novo espaço para seus planos</strong>
              <p>Separe suas finanças do jeito que faz sentido para você.</p>
              <span className="space-create-link">
                Criar espaço <ArrowUpRight size={15} />
              </span>
            </button>
          </div>
        )}
        <WorkspaceTrash />
        <div className="spaces-explanation">
          <span>
            <Layers3 size={19} />
          </span>
          <div>
            <strong>Organização que acompanha a sua vida.</strong>
            <p>
              Cada espaço tem suas próprias contas, categorias e movimentações. Ao trocar de espaço,
              você muda a visão completa das suas finanças.
            </p>
          </div>
          <ShieldCheck size={23} />
        </div>
        <footer className="spaces-footer">
          <span>MYWALLET</span>
          <span>Mais espaço para o que importa.</span>
        </footer>
      </main>
      <Modal
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value && !pending) setDeleting(null);
        }}
        title="Excluir espaço?"
        description="O espaço ficará na lixeira por 7 dias antes da exclusão definitiva."
      >
        <p>
          Excluir <strong>{deleting?.name}</strong>? As contas, movimentações, categorias, regras e
          planejamentos deste espaço ficarão indisponíveis. Você pode restaurar tudo durante o
          prazo.
        </p>
        {deleting?.id === active?.id && (
          <p className="field-help">
            Este espaço está em uso. Ao excluir, você voltará à seleção de espaços.
          </p>
        )}
        {!!deleteError && <ErrorState error={deleteError} />}
        <div className="workspace-delete-actions">
          <Button className="secondary" disabled={pending} onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            className="workspace-danger"
            disabled={pending || !navigator.onLine}
            onClick={() => void deleteWorkspace()}
          >
            {pending ? 'Excluindo…' : 'Mover para a lixeira'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Um novo espaço"
        description="Dê um nome e uma identidade para esta parte da sua vida financeira."
      >
        {open && <CreateWorkspaceForm />}
      </Modal>
    </div>
  );
}
