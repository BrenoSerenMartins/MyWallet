import { Tooltip } from '../shared/ui/tooltip';
import { productName } from '../shared/brand';
import { NotificationCenter } from '../shared/feedback/notification-center';
import { useNotifications } from '../shared/feedback/notification-provider';
import { useWorkspace } from '../features/workspaces/workspace-provider';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  CreditCard,
  ChartNoAxesCombined,
  UsersRound,
  CalendarDays,
  FolderTree,
  Menu,
  ArrowDownUp,
  ChevronRight,
  ChevronDown,
  House,
  Landmark,
  Settings2,
  Upload,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-provider';
import { Logo, Modal } from '../shared/ui/primitives';
const navigation = [
  { to: '/', label: 'Visão geral', mobile: 'Início', Icon: House },
  { to: '/transactions', label: 'Movimentações', mobile: 'Movimentos', Icon: ArrowDownUp },
  { to: '/accounts', label: 'Minhas contas', mobile: 'Contas', Icon: Landmark },
  { to: '/planning', label: 'Planejamento', mobile: 'Planejar', Icon: CalendarDays },
  { to: '/cards', label: 'Cartões e faturas', mobile: 'Cartões', Icon: CreditCard },
  {
    to: '/wealth',
    label: 'Investimentos e patrimônio',
    mobile: 'Patrimônio',
    Icon: ChartNoAxesCombined,
  },
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
const primaryPaths = ['/', '/transactions', '/accounts', '/planning', '/wealth'];
export function AppShell() {
  const { session } = useAuth();
  const notices = useNotifications();
  const wasOnline = useRef(navigator.onLine);
  const { active } = useWorkspace();
  const location = useLocation();
  const [arriving, setArriving] = useState(() => {
    try {
      return sessionStorage.getItem('plannedwallet:entered') !== 'yes';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem('plannedwallet:entered', 'yes');
    } catch {
      /* Storage is optional. */
    }
  }, []);
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
  useEffect(() => {
    if (!online)
      notices.warning(
        'Você está sem conexão. As alterações ficam indisponíveis até a internet voltar.',
        { id: 'connection', title: 'Sem conexão' },
      );
    else {
      notices.dismiss('connection');
      if (!wasOnline.current) notices.success('Conexão restabelecida. Você pode continuar.');
    }
    wasOnline.current = online;
  }, [online, notices.warning, notices.success, notices.dismiss]);
  useEffect(() => {
    if (!update) return;
    notices.info('Salve seus formulários antes de atualizar o aplicativo.', {
      id: 'app-update',
      title: 'Nova versão disponível',
      duration: 0,
      action: {
        label: 'Atualizar agora',
        run: () => {
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => window.location.reload(),
            { once: true },
          );
          update.postMessage('ACTIVATE_UPDATE');
        },
      },
    });
  }, [update, notices.info]);
  const name =
    session?.user.user_metadata?.full_name?.split(' ')[0] ??
    session?.user.email?.split('@')[0] ??
    'Você';
  return (
    <div
      className={`app-shell${arriving ? ' app-entry' : ''}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'app-arrive')
          setArriving(false);
      }}
    >
      <div className="app-main">
        <header className="app-header">
          <NavLink to="/" className="header-brand" aria-label={`${productName} — início`}>
            <Logo />
          </NavLink>
          <nav className="desktop-navigation" aria-label="Navegação principal">
            {navigation
              .filter((n) => primaryPaths.includes(n.to))
              .map(({ to, label, Icon }) => {
                const title = to === '/wealth' ? 'Patrimônio' : label;
                return (
                  <Tooltip key={to} text={title}>
                    <NavLink to={to} end={to === '/'} aria-label={title}>
                      <Icon size={17} strokeWidth={1.65} aria-hidden="true" />
                      <span>{title}</span>
                    </NavLink>
                  </Tooltip>
                );
              })}
          </nav>
          <div className="header-actions">
            <NotificationCenter />
            {!online && (
              <span className="connection-chip" aria-label="Sem conexão">
                <WifiOff size={16} />
              </span>
            )}
            <button
              type="button"
              className={`header-more header-space-menu ${navigation.filter((n) => !primaryPaths.includes(n.to)).some((n) => location.pathname.startsWith(n.to)) ? 'active' : ''}`}
              onClick={(event) => {
                menuTrigger.current = event.currentTarget;
                setMore(true);
              }}
              aria-haspopup="dialog"
              aria-label={`Menu do espaço: ${active?.name ?? 'Seu espaço'}`}
            >
              <span className="space-menu-avatar" aria-hidden="true">
                {active?.name.slice(0, 1).toLocaleUpperCase() ?? '·'}
              </span>
              <span>{active?.name ?? 'Seu espaço'}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
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
            ['/cards', '/wealth', '/categories', '/imports', '/counterparties', '/settings'].some(
              (path) => location.pathname.startsWith(path),
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
        title="Menu do espaço"
        description="Acesse as áreas e gerencie seus espaços."
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          menuTrigger.current?.focus();
        }}
      >
        <nav className="more-menu" aria-label="Mais funções">
          {[
            { title: 'Seu dinheiro', paths: ['/cards', '/wealth', '/imports'] },
            { title: 'Organização', paths: ['/categories', '/counterparties', '/settings'] },
          ].map((group) => (
            <div className="more-menu-group" key={group.title}>
              <h3>{group.title}</h3>
              {navigation
                .filter((n) => group.paths.includes(n.to))
                .map(({ to, label, Icon }) => (
                  <NavLink
                    to={to}
                    key={to}
                    className={primaryPaths.includes(to) ? 'menu-mobile-destination' : undefined}
                    onClick={() => setMore(false)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                    <ChevronRight size={16} />
                  </NavLink>
                ))}
            </div>
          ))}
          <NavLink to="/workspaces" onClick={() => setMore(false)}>
            <FolderTree size={21} />
            <span>Trocar de espaço</span>
            <ChevronRight size={17} />
          </NavLink>
        </nav>
        <div className="menu-profile">
          <strong>{name}</strong>
          <span>{session?.user.email}</span>
        </div>
      </Modal>
    </div>
  );
}
