import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ControlPopover } from './control-popover';
import { emitControlValue, useControlLabel } from './control-utils';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'>;
interface Choice {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === 'string' || typeof child === 'number'
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? text(child.props.children)
          : '',
    )
    .join('');
}
function choices(nodes: ReactNode, group?: string, disabled = false): Choice[] {
  return Children.toArray(nodes).flatMap((node) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        disabled?: boolean;
        label?: string;
      }>(node)
    )
      return [];
    if (node.type === 'optgroup')
      return choices(node.props.children, node.props.label, disabled || !!node.props.disabled);
    if (node.type === Fragment) return choices(node.props.children, group, disabled);
    if (node.type !== 'option') return [];
    const label = node.props.label ?? text(node.props.children);
    return [
      {
        value: String(node.props.value ?? label),
        label,
        disabled: disabled || !!node.props.disabled,
        group,
      },
    ];
  });
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
export function Select({
  children,
  value,
  defaultValue,
  id,
  className = '',
  disabled,
  required,
  onChange,
  onInvalid,
  ...props
}: SelectProps) {
  const generated = useId(),
    fieldId = id ?? generated;
  const native = useRef<HTMLSelectElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    restore = useRef(true);
  const label = useControlLabel(trigger, props['aria-label']);
  const options = choices(children);
  const [local, setLocal] = useState(
    String(defaultValue ?? options.find((option) => !option.disabled)?.value ?? ''),
  );
  const selected = String(value ?? local);
  const current = options.findIndex((o) => o.value === selected);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(current),
    [invalid, setInvalid] = useState(false);
  const buffer = useRef(''),
    bufferTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const optionRefs = useRef(new Map<number, HTMLDivElement>());
  useEffect(
    () => () => {
      if (bufferTimer.current) clearTimeout(bufferTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (open) optionRefs.current.get(active)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  function show(index = current) {
    if (disabled) return;
    restore.current = true;
    setActive(
      index >= 0 && !options[index]?.disabled ? index : options.findIndex((o) => !o.disabled),
    );
    setOpen(true);
  }
  function commit(index: number) {
    const choice = options[index];
    if (!choice || choice.disabled) return;
    setLocal(choice.value);
    setInvalid(false);
    restore.current = true;
    emitControlValue(native.current, choice.value);
    setOpen(false);
  }
  function move(direction: number) {
    let next = active;
    for (let step = 0; step < options.length; step++) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) {
        setActive(next);
        break;
      }
    }
  }
  return (
    <span className={`select-field ${className}`}>
      <button
        type="button"
        id={fieldId}
        ref={trigger}
        className="select-trigger"
        data-control-trigger="true"
        data-control="select"
        role="combobox"
        aria-label={label}
        aria-labelledby={props['aria-labelledby']}
        aria-expanded={open}
        aria-controls={open ? `${generated}-list` : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open && active >= 0 ? `${generated}-${active}` : undefined}
        aria-required={required}
        aria-invalid={props['aria-invalid'] ?? invalid}
        aria-describedby={props['aria-describedby']}
        disabled={disabled}
        data-value={selected}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (!open)
              show(
                event.key === 'End'
                  ? options.reduce((last, option, index) => (option.disabled ? last : index), -1)
                  : current,
              );
            else if (event.key === 'Home') setActive(options.findIndex((o) => !o.disabled));
            else if (event.key === 'End')
              setActive(
                options.reduce((last, option, index) => (option.disabled ? last : index), -1),
              );
            else move(event.key === 'ArrowDown' ? 1 : -1);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) commit(active);
            else show();
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            restore.current = true;
            setOpen(false);
          } else if (event.key === 'Tab' && open) {
            restore.current = false;
            setOpen(false);
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            buffer.current += normalize(event.key);
            if (bufferTimer.current) clearTimeout(bufferTimer.current);
            bufferTimer.current = setTimeout(() => {
              buffer.current = '';
            }, 700);
            const found = options.findIndex(
              (o) => !o.disabled && normalize(o.label).startsWith(buffer.current),
            );
            if (found >= 0) {
              if (!open) show(found);
              else setActive(found);
            }
          }
        }}
      >
        <span>{options[current]?.label ?? 'Selecionar'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <select
        {...props}
        id={`${fieldId}-native`}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        aria-label={undefined}
        aria-labelledby={undefined}
        data-native-control="select"
        ref={native}
        value={value ?? local}
        disabled={disabled}
        required={required}
        onChange={onChange}
        onInvalid={(event) => {
          onInvalid?.(event);
          event.preventDefault();
          setInvalid(true);
          show();
          trigger.current?.focus();
        }}
      >
        {children}
      </select>
      <ControlPopover
        id={`${generated}-list`}
        open={open}
        onOpenChange={setOpen}
        anchor={trigger}
        restoreFocus={restore}
        label={label}
        width={260}
        role="listbox"
        className="select-options"
      >
        <div role="presentation">
          {options.map((option, index) => (
            <Fragment key={`${option.value}-${index}`}>
              {option.group && options[index - 1]?.group !== option.group && (
                <div className="select-group-heading">{option.group}</div>
              )}
              <div
                ref={(node) => {
                  if (node) optionRefs.current.set(index, node);
                  else optionRefs.current.delete(index);
                }}
                id={`${generated}-${index}`}
                role="option"
                aria-selected={selected === option.value}
                aria-disabled={option.disabled || undefined}
                data-value={option.value}
                data-group={option.group}
                aria-label={option.group ? `${option.group}: ${option.label}` : option.label}
                data-highlighted={active === index}
                className="select-option"
                onPointerMove={(event) => {
                  if (event.pointerType !== 'touch' && !option.disabled) setActive(index);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== 'touch') event.preventDefault();
                }}
                onClick={() => commit(index)}
              >
                <span>{option.label}</span>
                <Check
                  size={15}
                  aria-hidden="true"
                  style={{ opacity: selected === option.value ? 1 : 0 }}
                />
              </div>
            </Fragment>
          ))}
        </div>
      </ControlPopover>
    </span>
  );
}
