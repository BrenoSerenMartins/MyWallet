import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type Ref,
} from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { ControlPopover } from './control-popover';
import { MonthPicker } from './month-picker';
import {
  displayDate,
  emitControlValue,
  isoDate,
  parseDate,
  useControlLabel,
  validDate,
} from './control-utils';
import { dateToday } from '../../formatting/money';

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement>;
}
export function DatePicker({
  value,
  defaultValue,
  id,
  className = '',
  required,
  disabled,
  min,
  max,
  onChange,
  onInvalid,
  ref: externalRef,
  ...props
}: DatePickerProps) {
  const generated = useId(),
    fieldId = id ?? generated;
  const native = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLInputElement>(null),
    active = useRef<HTMLButtonElement>(null),
    restore = useRef(true),
    focusGrid = useRef(false);
  const label = useControlLabel(trigger, props['aria-label']);
  const [local, setLocal] = useState(String(defaultValue ?? ''));
  const selected = String(value ?? local),
    base = validDate(selected) ? selected : dateToday();
  const [draft, setDraft] = useState(displayDate(selected)),
    [invalid, setInvalid] = useState(false),
    [open, setOpen] = useState(false),
    [view, setView] = useState(base.slice(0, 7)),
    [focused, setFocused] = useState(base);
  const minimum = String(min ?? '0001-01-01'),
    maximum = String(max ?? '9999-12-31');
  const allowed = (date: string) => validDate(date) && date >= minimum && date <= maximum;
  useEffect(() => {
    setDraft(displayDate(selected));
    setInvalid(false);
    native.current?.setCustomValidity('');
  }, [selected]);
  const [year, month] = view.split('-').map(Number);
  const first = new Date(`${view}-01T12:00:00Z`).getUTCDay();
  const days = Array.from({ length: 42 }, (_, index) =>
    isoDate(year, month - 1, index - first + 1),
  );
  function show() {
    if (disabled) return;
    const date = allowed(base) ? base : base < minimum ? minimum : maximum;
    setView(date.slice(0, 7));
    setFocused(date);
    restore.current = true;
    setOpen(true);
  }
  function commit(date: string) {
    if (date && !allowed(date)) return;
    setLocal(date);
    setDraft(displayDate(date));
    setInvalid(false);
    native.current?.setCustomValidity('');
    emitControlValue(native.current, date);
    restore.current = true;
    setOpen(false);
  }
  function edit(text: string) {
    setDraft(text);
    const parsed = text.trim() ? parseDate(text) : '';
    const valid = parsed !== null && (!parsed || allowed(parsed));
    native.current?.setCustomValidity(
      valid ? '' : 'Informe uma data válida no formato dia/mês/ano.',
    );
    setInvalid(false);
    if (valid) {
      setLocal(parsed!);
      emitControlValue(native.current, parsed!);
    }
  }
  function move(offset: number) {
    const date = new Date(`${focused}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const candidate = date.toISOString().split('T')[0];
    if (!allowed(candidate)) return;
    focusGrid.current = true;
    setView(candidate.slice(0, 7));
    setFocused(candidate);
  }
  function shiftMonth(offset: number) {
    const date = isoDate(year, month - 1 + offset, 1).slice(0, 7);
    if (date < minimum.slice(0, 7) || date > maximum.slice(0, 7)) return;
    setView(date);
    setFocused(`${date}-01` < minimum ? minimum : `${date}-01`);
  }
  useLayoutEffect(() => {
    if (open && focusGrid.current) {
      active.current?.focus({ preventScroll: true });
      focusGrid.current = false;
    }
  }, [focused, open]);
  return (
    <span className={`date-field ${className}`}>
      <input
        {...props}
        id={fieldId}
        name={undefined}
        ref={(node) => {
          trigger.current = node;
          if (typeof externalRef === 'function') return externalRef(node);
          if (externalRef) externalRef.current = node;
        }}
        type="text"
        role="combobox"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        className="date-trigger"
        value={draft}
        data-value={selected}
        data-calendar-date="true"
        maxLength={10}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${generated}-calendar` : undefined}
        aria-invalid={props['aria-invalid'] || invalid}
        aria-describedby={
          [props['aria-describedby'], invalid ? `${generated}-error` : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
        disabled={disabled}
        required={required}
        onInvalid={(event) => {
          onInvalid?.(event);
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
        }}
        onChange={(event) => edit(event.target.value)}
        onBlur={(event) => {
          props.onBlur?.(event);
          const parsed = draft.trim() ? parseDate(draft) : '';
          if (parsed !== null && (!parsed || allowed(parsed))) setDraft(displayDate(parsed));
          else setInvalid(true);
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            show();
          }
        }}
      />
      <input
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-native-control="date"
        ref={native}
        type="date"
        value={value ?? local}
        name={props.name}
        form={props.form}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={onChange}
        onInvalid={(event) => {
          onInvalid?.(event);
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
        }}
      />
      <button
        type="button"
        className="date-calendar-button"
        aria-label={`Abrir calendário: ${label}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <CalendarDays size={16} />
      </button>
      {invalid && (
        <span id={`${generated}-error`} className="control-field-error" role="alert">
          Use uma data válida: dd/mm/aaaa.
        </span>
      )}
      <ControlPopover
        open={open}
        onOpenChange={setOpen}
        anchor={trigger}
        restoreFocus={restore}
        label={`Selecionar data: ${label}`}
        className="date-popover"
        onReady={() => active.current?.focus({ preventScroll: true })}
      >
        <div className="calendar-header">
          <button
            type="button"
            className="icon-button"
            aria-label="Mês anterior no calendário"
            disabled={view <= minimum.slice(0, 7)}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <MonthPicker
            aria-label="Mês do calendário"
            value={view}
            min={minimum.slice(0, 7)}
            max={maximum.slice(0, 7)}
            clearable={false}
            onChange={(event) => {
              setView(event.target.value);
              setFocused(
                `${event.target.value}-01` < minimum ? minimum : `${event.target.value}-01`,
              );
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Próximo mês no calendário"
            disabled={view >= maximum.slice(0, 7)}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div
          id={`${generated}-calendar`}
          className="date-grid"
          role="grid"
          aria-label="Dias do mês"
          onKeyDown={(event) => {
            const offsets: Record<string, number> = {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -7,
              ArrowDown: 7,
              Home: -new Date(`${focused}T12:00:00Z`).getUTCDay(),
              End: 6 - new Date(`${focused}T12:00:00Z`).getUTCDay(),
            };
            if (event.key in offsets) {
              event.preventDefault();
              move(offsets[event.key]);
            }
          }}
        >
          <div role="row" className="calendar-weekdays">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <span role="columnheader" key={day}>
                {day}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div role="row" key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => (
                <button
                  type="button"
                  role="gridcell"
                  key={day}
                  ref={day === focused ? active : undefined}
                  tabIndex={day === focused ? 0 : -1}
                  aria-label={new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'full',
                    timeZone: 'UTC',
                  }).format(new Date(`${day}T12:00:00Z`))}
                  aria-selected={day === selected}
                  data-date={day}
                  data-outside={day.slice(0, 7) !== view}
                  data-today={day === dateToday()}
                  disabled={!allowed(day)}
                  onFocus={() => setFocused(day)}
                  onClick={() => commit(day)}
                >
                  {new Date(`${day}T12:00:00Z`).getUTCDate()}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="calendar-footer">
          {!required && (
            <button type="button" className="text-button" onClick={() => commit('')}>
              Limpar
            </button>
          )}
          <button
            type="button"
            className="text-button"
            disabled={!allowed(dateToday())}
            onClick={() => commit(dateToday())}
          >
            Hoje
          </button>
        </div>
      </ControlPopover>
    </span>
  );
}
