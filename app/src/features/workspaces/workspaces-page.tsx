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
import { WorkspaceCard } from './components/workspace-card';
import { CreateWorkspaceForm } from './components/create-workspace-form';
import './workspaces.css';
export function WorkspacesPage() {
  const { workspaces, active, loading, error, reload, select } = useWorkspace();
  const [open, setOpen] = useState(false);
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
