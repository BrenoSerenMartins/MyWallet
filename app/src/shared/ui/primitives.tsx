import { Tooltip } from './tooltip';
import { BrandSymbol } from './brand-symbol';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { AlertCircle, ArrowUpRight, Wallet, Sun, Moon, Monitor, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTheme } from '../../app/providers/theme-provider';
export function Logo() {
  return (
    <span className="logo">
      <BrandSymbol />
      <span className="logo-wordmark">
        Planned<span>Wallet</span>
      </span>
    </span>
  );
}
export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
export function EmptyState({
  title,
  children,
  action,
  icon,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      <span className="empty-icon" aria-hidden="true">
        {icon ?? <Wallet size={28} strokeWidth={1.5} />}
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Não foi possível carregar</strong>
        <p>{error instanceof Error ? error.message : 'Tente novamente em instantes.'}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Tentar novamente <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div aria-label="Carregando" role="status" className="loading">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function ThemeSwitcher({ expanded = false }: { expanded?: boolean }) {
  const { mode, setMode } = useTheme();
  return (
    <div className={`theme-switcher ${expanded ? 'theme-options' : ''}`} aria-label="Tema">
      {(
        [
          { mode: 'light', label: 'Claro', Icon: Sun },
          { mode: 'dark', label: 'Escuro', Icon: Moon },
          { mode: 'system', label: 'Sistema', Icon: Monitor },
        ] as const
      ).map(({ mode: value, label, Icon }) => (
        <Tooltip key={value} text={`Usar tema ${label.toLocaleLowerCase('pt-BR')}`}>
          <button
            type="button"
            aria-label={`Tema ${label.toLowerCase()}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {expanded && (
              <span className={`theme-preview preview-${value}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            )}
            <Icon size={16} />
            {expanded && <span>{label}</span>}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onCloseAutoFocus,
  variant = 'dialog',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  variant?: 'dialog' | 'detail';
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<{ height: number; top: number }>();
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const view = window.visualViewport;
    const update = () => setViewport({ height: view.height, top: view.offsetTop });
    update();
    view.addEventListener('resize', update);
    view.addEventListener('scroll', update);
    return () => {
      view.removeEventListener('resize', update);
      view.removeEventListener('scroll', update);
    };
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          style={
            viewport
              ? ({
                  '--dialog-height': `${viewport.height}px`,
                  '--dialog-top': `${viewport.top}px`,
                } as CSSProperties)
              : undefined
          }
          onEscapeKeyDown={(event) => {
            if (document.querySelector('[role="tooltip"]')) {
              event.preventDefault();
              window.dispatchEvent(new Event('plannedwallet:dismiss-tooltip'));
            }
          }}
          className={`dialog-content ${variant === 'detail' ? 'dialog-detail' : ''}`}
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            if (onCloseAutoFocus) onCloseAutoFocus(event);
            else if (previousFocus.current?.isConnected) {
              event.preventDefault();
              const active = document.activeElement;
              if (!active || active === document.body || active.closest('[role=dialog]'))
                previousFocus.current.focus();
            }
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ?? 'Preencha os dados e confira antes de salvar.'}
              </Dialog.Description>
            </div>
            <Tooltip text="Fechar">
              <Dialog.Close className="icon-button" aria-label="Fechar">
                <X size={20} />
              </Dialog.Close>
            </Tooltip>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
