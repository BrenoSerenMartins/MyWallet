import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

type TargetProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement>; disabled?: boolean };
/** Descriptions have no interactive content. Actions still execute on the first tap. */
export function Tooltip({
  text,
  children,
  activation = 'describe',
}: {
  text: string;
  children: ReactElement;
  activation?: 'describe' | 'help';
}) {
  const id = useId();
  const child = children as ReactElement<TargetProps>;
  const anchor = useRef<HTMLElement | null>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, maxWidth: 300, maxHeight: 240 });
  const childRef = child.props.ref;
  const attach = useCallback(
    (node: HTMLElement | null) => {
      anchor.current = node;
      const cleanup = typeof childRef === 'function' ? childRef(node) : undefined;
      if (childRef && typeof childRef !== 'function') childRef.current = node;
      return () => {
        anchor.current = null;
        if (typeof cleanup === 'function') cleanup();
        else if (typeof childRef === 'function') childRef(null);
        else if (childRef) childRef.current = null;
      };
    },
    [childRef],
  );
  const cancelTimer = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const outside = (event: PointerEvent) => {
      if (
        !anchor.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        close();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('plannedwallet:dismiss-tooltip', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('plannedwallet:dismiss-tooltip', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!anchor.current || !popup.current) return;
      const target = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      const maxWidth = Math.min(300, Math.max(1, width - 24));
      const maxHeight = Math.min(240, Math.max(1, height * 0.4));
      popup.current.style.maxWidth = `${maxWidth}px`;
      popup.current.style.maxHeight = `${maxHeight}px`;
      const box = popup.current.getBoundingClientRect();
      const left = Math.max(
        offsetLeft + 12,
        Math.min(
          target.left + target.width / 2 - box.width / 2,
          offsetLeft + width - box.width - 12,
        ),
      );
      const below = target.bottom + 8;
      const top = Math.max(
        offsetTop + 12,
        Math.min(
          below + box.height > offsetTop + height - 12 ? target.top - box.height - 8 : below,
          offsetTop + height - box.height - 12,
        ),
      );
      setPosition({ left, top, maxWidth, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, text]);
  return (
    <>
      {cloneElement(child, {
        ref: attach,
        title: undefined,
        'aria-describedby':
          [child.props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') ||
          undefined,
        ...(activation === 'help'
          ? { 'aria-expanded': open, 'aria-controls': open ? id : undefined }
          : {}),
        onPointerEnter: (event) => {
          child.props.onPointerEnter?.(event);
          if (event.pointerType !== 'touch' && !event.defaultPrevented) {
            cancelTimer();
            timer.current = setTimeout(() => setOpen(true), 350);
          }
        },
        onPointerLeave: (event) => {
          child.props.onPointerLeave?.(event);
          cancelTimer();
          timer.current = setTimeout(() => {
            if (document.activeElement !== anchor.current) setOpen(false);
          }, 150);
        },
        onFocus: (event) => {
          child.props.onFocus?.(event);
          cancelTimer();
          if (
            activation === 'describe' &&
            event.currentTarget.matches(':focus-visible') &&
            !event.defaultPrevented
          )
            setOpen(true);
        },
        onBlur: (event) => {
          child.props.onBlur?.(event);
          cancelTimer();
          setOpen(false);
        },
        onClick: (event) => {
          child.props.onClick?.(event);
          cancelTimer();
          if (activation === 'help') setOpen((value) => !value);
          else setOpen(false);
        },
      })}
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            className="app-tooltip"
            role="tooltip"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            style={position}
            onPointerEnter={cancelTimer}
            onPointerLeave={() => {
              if (document.activeElement !== anchor.current) setOpen(false);
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
/** Explicit touch/keyboard help for terms, rather than hiding essential labels. */
export function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip text={text} activation="help">
      <button type="button" className="help-tip" aria-label={`Ajuda: ${label}`}>
        <CircleHelp size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
