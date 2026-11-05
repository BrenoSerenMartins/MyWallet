import { Tooltip } from './tooltip';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';

/** Native disclosure with ordinary tab navigation, not a partial ARIA menu. */
export function ActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      root.current?.removeAttribute('open');
      root.current?.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <details
      ref={root}
      className="action-menu"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <Tooltip text={label}>
        <summary aria-label={label}>
          <Ellipsis size={19} />
        </summary>
      </Tooltip>
      <div
        className="action-menu-panel"
        role="group"
        aria-label={label}
        onClickCapture={(event) => {
          if ((event.target as Element).closest('button, a')) {
            root.current?.removeAttribute('open');
            root.current?.querySelector('summary')?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
