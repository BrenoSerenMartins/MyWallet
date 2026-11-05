import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** Nested non-modal Radix scope keeps portalled controls usable inside form dialogs. */
export function ControlPopover({
  open,
  id,
  onOpenChange,
  anchor,
  restoreFocus,
  label,
  children,
  width = 320,
  className = '',
  role = 'dialog',
  onReady,
}: {
  id?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
  restoreFocus: RefObject<boolean>;
  label: string;
  children: ReactNode;
  width?: number;
  className?: string;
  role?: 'dialog' | 'listbox';
  onReady?: (element: HTMLDivElement) => void;
}) {
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const lastContent = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  }>();
  const didFocus = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      didFocus.current = false;
      setPosition(undefined);
      return;
    }
    if (!content || !anchor.current) return;
    const element = content;
    lastContent.current = content;
    const place = () => {
      if (!anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0,
        topEdge = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? innerWidth,
        viewportHeight = viewport?.height ?? innerHeight;
      const targetWidth = Math.min(
        role === 'listbox' ? Math.max(width, rect.width) : width,
        viewportWidth - 24,
      );
      const maxHeight = Math.min(420, viewportHeight - 24);
      element.style.width = `${targetWidth}px`;
      element.style.maxHeight = `${maxHeight}px`;
      const height = element.getBoundingClientRect().height;
      const below = topEdge + viewportHeight - rect.bottom - 12,
        above = rect.top - topEdge - 12;
      const top = height > below && above > below ? rect.top - height - 8 : rect.bottom + 8;
      setPosition({
        left: Math.max(
          leftEdge + 12,
          Math.min(rect.left, leftEdge + viewportWidth - targetWidth - 12),
        ),
        top: Math.max(topEdge + 12, Math.min(top, topEdge + viewportHeight - height - 12)),
        width: targetWidth,
        maxHeight,
      });
    };
    place();
    let focusFrame = 0;
    if (!didFocus.current) {
      didFocus.current = true;
      focusFrame = requestAnimationFrame(() => onReady?.(element));
    }
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(focusFrame);
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, content, width, role, anchor]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          id={id}
          ref={setContent}
          role={role}
          data-control-popup="true"
          className={`control-popover ${className}`}
          aria-describedby={undefined}
          style={
            position ? { ...position, visibility: 'visible' } : { visibility: 'hidden', width }
          }
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (document.querySelector('[role="tooltip"]')) {
              event.preventDefault();
              window.dispatchEvent(new Event('plannedwallet:dismiss-tooltip'));
            } else restoreFocus.current = true;
          }}
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target as Node | null;
            if (
              anchor.current?.contains(target) ||
              (event.detail.originalEvent.type === 'focusin' && target === document.body)
            )
              event.preventDefault();
            else restoreFocus.current = false;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const active = document.activeElement;
            if (
              restoreFocus.current &&
              anchor.current?.isConnected &&
              (!active ||
                active === document.body ||
                lastContent.current?.contains(active) ||
                anchor.current.contains(active))
            )
              anchor.current.focus({ preventScroll: true });
          }}
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
