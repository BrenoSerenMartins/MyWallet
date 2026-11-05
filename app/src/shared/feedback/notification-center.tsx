import { Tooltip } from '../ui/tooltip';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Modal } from '../ui/primitives';
import { noticeIcons, useNotifications } from './notification-provider';

export function NotificationCenter() {
  const { items, readAll, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;
  return (
    <>
      <Tooltip text="Abrir notificações">
        <button
          type="button"
          className="icon-button notification-trigger"
          aria-label="Abrir notificações"
          aria-haspopup="dialog"
          onClick={() => {
            readAll();
            setOpen(true);
          }}
        >
          <Bell size={19} />
          {unread > 0 && (
            <span className="notification-count" aria-label={`${unread} avisos recentes`}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Tooltip>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Notificações"
        description="Avisos desta sessão e deste espaço. Você pode consultá-los depois que o popup fechar."
      >
        {!items.length ? (
          <p className="notification-empty">Nenhum aviso por aqui.</p>
        ) : (
          <>
            <div className="notification-history-tools">
              <span>{items.length} avisos</span>
              <button className="text-button" onClick={clear}>
                Limpar notificações
              </button>
            </div>
            <ol className="notification-history">
              {[...items].reverse().map((item) => {
                const Icon = noticeIcons[item.tone];
                return (
                  <li key={item.id} className={`notice-${item.tone}`}>
                    <Icon size={18} aria-hidden="true" />
                    <div>
                      {item.title && <strong>{item.title}</strong>}
                      <p>{item.message}</p>
                      {item.action && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setOpen(false);
                            item.action!.run();
                          }}
                        >
                          {item.action.label}
                        </button>
                      )}
                      <time dateTime={new Date(item.createdAt).toISOString()}>
                        {new Intl.DateTimeFormat('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(item.createdAt)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </Modal>
    </>
  );
}
