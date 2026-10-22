import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, Wallet, Sun, Moon, Monitor, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTheme } from '../../app/providers/theme-provider';
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Wallet size={23} />
      </span>
      <span>
        mywallet<span className="logo-dot">.</span>
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
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Wallet size={26} />
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
export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  return (
    <div className="theme-switcher" aria-label="Tema">
      {(
        [
          { mode: 'light', label: 'Claro', Icon: Sun },
          { mode: 'dark', label: 'Escuro', Icon: Moon },
          { mode: 'system', label: 'Sistema', Icon: Monitor },
        ] as const
      ).map(({ mode: value, label, Icon }) => (
        <button
          key={value}
          title={label}
          aria-label={`Tema ${label.toLowerCase()}`}
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
        >
          <Icon size={16} />
        </button>
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ?? 'Preencha os dados e confira antes de salvar.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Fechar">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
