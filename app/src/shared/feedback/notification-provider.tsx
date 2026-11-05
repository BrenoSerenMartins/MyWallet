import { Tooltip } from '../ui/tooltip';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';

export type NoticeTone = 'success' | 'info' | 'warning' | 'error';
export interface NoticeOptions {
  id?: string;
  title?: string;
  duration?: number;
  action?: { label: string; run: () => void };
}
export interface Notice extends NoticeOptions {
  id: string;
  message: string;
  tone: NoticeTone;
  createdAt: number;
  revision: number;
  active: boolean;
  read: boolean;
  duration: number;
}
interface Notifications {
  epoch: number;
  currentEpoch: () => number;
  items: Notice[];
  success: (message: string, options?: NoticeOptions) => void;
  info: (message: string, options?: NoticeOptions) => void;
  warning: (message: string, options?: NoticeOptions) => void;
  error: (message: string, options?: NoticeOptions) => void;
  dismiss: (id: string) => void;
  readAll: () => void;
  clear: () => void;
}
const Context = createContext<Notifications | null>(null);
export function useNotifications(scope: 'workspace' | 'session' = 'workspace') {
  const context = useContext(Context);
  if (!context) throw new Error('NotificationProvider is required.');
  const { success, info, warning, error, dismiss, readAll, clear, epoch, currentEpoch } = context;
  const actions = useMemo(() => {
    const valid = () => scope === 'session' || epoch === currentEpoch();
    return {
      success: (message: string, options?: NoticeOptions) => {
        if (valid()) success(message, options);
      },
      info: (message: string, options?: NoticeOptions) => {
        if (valid()) info(message, options);
      },
      warning: (message: string, options?: NoticeOptions) => {
        if (valid()) warning(message, options);
      },
      error: (message: string, options?: NoticeOptions) => {
        if (valid()) error(message, options);
      },
      dismiss: (id: string) => {
        if (valid()) dismiss(id);
      },
      readAll,
      clear,
    };
  }, [success, info, warning, error, dismiss, readAll, clear, epoch, currentEpoch, scope]);
  return { items: context.items, ...actions };
}

export const noticeIcons = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [announcement, setAnnouncement] = useState<Notice>();
  const epochRef = useRef(0);
  const sequence = useRef(0);
  const [epoch, setEpoch] = useState(0);
  const currentEpoch = useCallback(() => epochRef.current, []);
  useEffect(() => {
    const clear = () => {
      epochRef.current += 1;
      setEpoch(epochRef.current);
      setItems([]);
      setAnnouncement(undefined);
    };
    window.addEventListener('mywallet:workspace-changed', clear);
    return () => window.removeEventListener('mywallet:workspace-changed', clear);
  }, []);
  const push = useCallback((tone: NoticeTone, message: string, options: NoticeOptions = {}) => {
    if (!message.trim()) return;
    const item: Notice = {
      ...options,
      id: options.id ?? crypto.randomUUID(),
      message,
      tone,
      createdAt: Date.now(),
      revision: ++sequence.current,
      active: true,
      read: false,
      duration:
        options.duration ??
        (tone === 'error' || tone === 'warning'
          ? 0
          : Math.max(7000, Math.min(18000, message.length * 65))),
    };
    setItems((current) => [...current.filter((n) => n.id !== item.id), item].slice(-40));
    setAnnouncement(item);
  }, []);
  const dismiss = useCallback((id: string) => {
    setItems((current) => current.map((n) => (n.id === id ? { ...n, active: false } : n)));
    setAnnouncement((current) => (current?.id === id ? undefined : current));
  }, []);
  const readAll = useCallback(() => {
    setItems((current) => current.map((n) => ({ ...n, read: true, active: false })));
    setAnnouncement(undefined);
  }, []);
  const clear = useCallback(() => {
    setItems([]);
    setAnnouncement(undefined);
  }, []);
  const actions = useMemo(
    () => ({
      success: (message: string, options?: NoticeOptions) => push('success', message, options),
      info: (message: string, options?: NoticeOptions) => push('info', message, options),
      warning: (message: string, options?: NoticeOptions) => push('warning', message, options),
      error: (message: string, options?: NoticeOptions) => push('error', message, options),
      dismiss,
      readAll,
      clear,
    }),
    [push, dismiss, readAll, clear],
  );
  const active = items.filter((n) => n.active);
  return (
    <Context.Provider value={{ ...actions, items, epoch, currentEpoch }}>
      {children}
      {createPortal(
        <>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement && announcement.tone !== 'error' && (
              <span key={announcement.revision}>
                {announcement.title ? `${announcement.title}. ` : ''}
                {announcement.message}
              </span>
            )}
          </div>
          <div
            className="sr-only"
            role={announcement?.tone === 'error' ? 'alert' : undefined}
            aria-live="assertive"
            aria-atomic="true"
          >
            {announcement?.tone === 'error' && (
              <span key={announcement.revision}>
                {announcement.title ? `${announcement.title}. ` : ''}
                {announcement.message}
              </span>
            )}
          </div>
          <section
            className="notification-viewport"
            aria-label="Notificações"
            aria-relevant="additions"
            aria-live="off"
          >
            {active.slice(0, 3).map((item) => (
              <Toast key={`${item.id}:${item.revision}`} item={item} onDismiss={dismiss} />
            ))}
            {active.length > 3 && (
              <p className="notification-pending">Mais {active.length - 3} avisos na fila</p>
            )}
          </section>
        </>,
        document.body,
      )}
    </Context.Provider>
  );
}
function Toast({ item, onDismiss }: { item: Notice; onDismiss: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const remaining = useRef(item.duration);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!item.duration || hovered || focused || hidden) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [item.id, item.duration, hovered, focused, hidden, onDismiss]);
  const Icon = noticeIcons[item.tone];
  return (
    <article
      className={`notification-toast notice-${item.tone}`}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <Icon size={19} aria-hidden="true" />
      <div className="notification-copy">
        {item.title && <strong>{item.title}</strong>}
        <p>{item.message}</p>
      </div>
      <Tooltip text="Dispensar notificação">
        <button
          type="button"
          className="icon-button"
          aria-label="Dispensar notificação"
          onClick={() => onDismiss(item.id)}
        >
          <X size={16} />
        </button>
      </Tooltip>
      {item.action && (
        <button
          type="button"
          className="text-button notification-action"
          onClick={() => {
            item.action!.run();
            onDismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
    </article>
  );
}
