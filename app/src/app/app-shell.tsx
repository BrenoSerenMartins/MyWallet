import { useWorkspace } from '../features/workspaces/workspace-provider';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  UsersRound,
  CalendarDays,
  FolderTree,
  Menu,
  ArrowDownUp,
  ArrowUpRight,
  ChevronRight,
  House,
  Landmark,
  LogOut,
  Plus,
  Settings2,
  Upload,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-provider';
import { authClient } from '../shared/api/auth-client';
import { Logo, ThemeSwitcher, Button, Modal } from '../shared/ui/primitives';
const navigation = [
  { to: '/', label: 'Visão geral', mobile: 'Início', Icon: House },
  { to: '/transactions', label: 'Movimentações', mobile: 'Movimentos', Icon: ArrowDownUp },
  { to: '/accounts', label: 'Minhas contas', mobile: 'Contas', Icon: Landmark },
  { to: '/planning', label: 'Planejamento', mobile: 'Planejar', Icon: CalendarDays },
  { to: '/imports', label: 'Importar extrato', mobile: 'Importar', Icon: Upload },
  { to: '/categories', label: 'Grupos e categorias', mobile: 'Categorias', Icon: FolderTree },
  {
    to: '/counterparties',
    label: 'Pessoas e estabelecimentos',
    mobile: 'Pessoas',
    Icon: UsersRound,
  },
  { to: '/settings', label: 'Preferências', mobile: 'Mais', Icon: Settings2 },
];
export function AppShell() {
  const { session } = useAuth();
  const { active } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting) setUpdate(reg.waiting);
      reg.addEventListener('updatefound', () =>
        reg.installing?.addEventListener('statechange', () => {
          if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg.waiting);
        }),
      );
    });
  }, []);
  const current = navigation.find((n) =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to),
  );
  const name =
    session?.user.user_metadata?.full_name?.split(' ')[0] ??
    session?.user.email?.split('@')[0] ??
    'Você';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand-link">
          <Logo />
        </NavLink>
        <NavLink to="/workspaces" className="workspace-label" aria-label="Trocar de espaço">
          <span className="workspace-icon">{active?.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{active?.name}</strong>
            <span>Trocar de espaço</span>
          </div>
          <ChevronRight size={15} />
        </NavLink>
        <nav aria-label="Navegação principal">
          {['Seu dinheiro', 'Organização'].map((section, index) => (
            <details className="nav-group" open key={section}>
              <summary>
                {section}
                <ChevronRight size={14} />
              </summary>
              {navigation
                .filter((item) =>
                  index === 0
                    ? ['/', '/transactions', '/accounts'].includes(item.to)
                    : !['/', '/transactions', '/accounts'].includes(item.to),
                )
                .map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                  </NavLink>
                ))}
            </details>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <ArrowUpRight size={20} />
          </span>
          <strong>
            Seu próximo passo
            <br />
            começa com clareza.
          </strong>
          <p>Organize suas contas e acompanhe cada movimento.</p>
          <NavLink to="/imports">
            Importar meu extrato <ArrowUpRight size={14} />
          </NavLink>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <span>Conta pessoal</span>
          </div>
          <button
            className="icon-button"
            aria-label="Sair da conta"
            onClick={() => void authClient.auth.signOut()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <span className="breadcrumb">
            <NavLink to="/workspaces">{active?.name}</NavLink> <ChevronRight size={13} />
            <strong>{current?.label ?? 'Detalhes'}</strong>
          </span>
          <span className="mobile-logo">
            <Logo />
          </span>
          <div className="topbar-actions">
            <ThemeSwitcher />
            <Button
              className="compact"
              onClick={() => navigate('/transactions?new=1')}
              disabled={!online}
            >
              <Plus size={17} />
              <span>Novo lançamento</span>
            </Button>
          </div>
        </header>
        <NavLink to="/workspaces" className="workspace-mobile-link" aria-label="Trocar de espaço">
          <span>
            Espaço <strong>{active?.name}</strong>
          </span>
          <ChevronRight size={15} />
        </NavLink>
        {!online && (
          <div className="connection-banner" role="status">
            <WifiOff size={18} /> Você está sem conexão. As alterações ficam indisponíveis até a
            internet voltar.
          </div>
        )}
        {update && (
          <div className="connection-banner" role="status">
            Nova versão disponível. Salve seus formulários antes de atualizar.
            <button
              className="text-button"
              onClick={() => {
                navigator.serviceWorker.addEventListener(
                  'controllerchange',
                  () => window.location.reload(),
                  { once: true },
                );
                update.postMessage('ACTIVATE_UPDATE');
              }}
            >
              Atualizar agora
            </button>
          </div>
        )}
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>MYWALLET</span>
          <span>Uma visão mais clara. Um passo de cada vez.</span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navegação móvel">
        {navigation
          .filter((n) => ['/', '/transactions', '/accounts', '/planning'].includes(n.to))
          .map(({ to, mobile, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={20} />
              <span>{mobile}</span>
            </NavLink>
          ))}
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-haspopup="dialog"
          className={
            ['/categories', '/imports', '/counterparties', '/settings'].some((path) =>
              location.pathname.startsWith(path),
            )
              ? 'active'
              : ''
          }
        >
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>
      <Modal open={more} onOpenChange={setMore} title="Explorar seu espaço">
        <nav className="more-menu" aria-label="Mais funções">
          {navigation
            .filter((n) =>
              ['/imports', '/categories', '/counterparties', '/settings'].includes(n.to),
            )
            .map(({ to, label, Icon }) => (
              <NavLink to={to} key={to} onClick={() => setMore(false)}>
                <Icon size={21} />
                <span>{label}</span>
                <ChevronRight size={17} />
              </NavLink>
            ))}
          <NavLink to="/workspaces" onClick={() => setMore(false)}>
            <FolderTree size={21} />
            <span>Trocar de espaço</span>
            <ChevronRight size={17} />
          </NavLink>
        </nav>
      </Modal>
    </div>
  );
}
