import { useWorkspace } from '../features/workspaces/workspace-provider';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  UsersRound,
  CalendarDays,
  FolderTree,
  Menu,
  ArrowDownUp,
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
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
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
  const name =
    session?.user.user_metadata?.full_name?.split(' ')[0] ??
    session?.user.email?.split('@')[0] ??
    'Você';
  return (
    <div className="app-shell">
      <div className="app-main">
        <header className="app-header">
          <NavLink to="/" className="header-brand" aria-label="MyWallet — início">
            <Logo />
          </NavLink>
          <nav className="desktop-navigation" aria-label="Navegação principal">
            {navigation.slice(0, 4).map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <NavLink
              to="/workspaces"
              className="workspace-pill"
              aria-label="Trocar de espaço"
              title={active?.name}
            >
              <span>{active?.name}</span>
              <ChevronRight size={14} />
            </NavLink>
            <Button
              className="compact header-create"
              aria-label="Novo lançamento"
              onClick={() => navigate('/transactions?new=1')}
              disabled={!online}
            >
              <Plus size={18} />
              <span>Novo lançamento</span>
            </Button>
            <button
              type="button"
              className={`header-more ${navigation.slice(4).some((n) => location.pathname.startsWith(n.to)) ? 'active' : ''}`}
              onClick={(event) => {
                menuTrigger.current = event.currentTarget;
                setMore(true);
              }}
              aria-haspopup="dialog"
            >
              <Menu size={18} />
              <span>Mais</span>
            </button>
          </div>
        </header>
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
          onClick={(event) => {
            menuTrigger.current = event.currentTarget;
            setMore(true);
          }}
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
      <Modal
        open={more}
        onOpenChange={setMore}
        title="Menu e preferências"
        description="Importe extratos, organize seus dados e ajuste a aparência."
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          menuTrigger.current?.focus();
        }}
      >
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
        <div className="menu-preferences">
          <span>Aparência</span>
          <ThemeSwitcher />
        </div>
        <div className="menu-profile">
          <strong>{name}</strong>
          <button
            type="button"
            className="text-button"
            onClick={() => void authClient.auth.signOut()}
          >
            <LogOut size={17} />
            Sair da conta
          </button>
        </div>
      </Modal>
    </div>
  );
}
