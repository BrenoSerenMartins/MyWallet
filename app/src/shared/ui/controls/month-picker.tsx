import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { ControlPopover } from './control-popover';
import { emitControlValue, monthNames, useControlLabel } from './control-utils';
import { dateToday } from '../../formatting/money';

export interface MonthPickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  clearable?: boolean;
}
export function MonthPicker({
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
  clearable = !required,
  ...props
}: MonthPickerProps) {
  const generated = useId(),
    fieldId = id ?? generated;
  const native = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    active = useRef<HTMLButtonElement>(null),
    restore = useRef(true),
    focusGrid = useRef(false);
  const label = useControlLabel(trigger, props['aria-label']);
  const [local, setLocal] = useState(String(defaultValue ?? ''));
  const selected = String(value ?? local),
    fallback = /^\d{4}-(0[1-9]|1[0-2])$/.test(selected) ? selected : dateToday().slice(0, 7);
  const minimum = String(min ?? '0001-01'),
    maximum = String(max ?? '9999-12');
  const minYear = Number(minimum.slice(0, 4)),
    maxYear = Number(maximum.slice(0, 4));
  const [open, setOpen] = useState(false),
    [yearText, setYearText] = useState(fallback.slice(0, 4)),
    [activeMonth, setActiveMonth] = useState(Number(fallback.slice(5)) - 1),
    [invalid, setInvalid] = useState(false);
  const year = Number(yearText),
    validYear = /^\d{1,4}$/.test(yearText) && year >= minYear && year <= maxYear;
  const stamp = (month: number, y = year) =>
    `${String(y).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`;
  const allowed = (month: string) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= minimum && month <= maximum;
  function show() {
    if (disabled) return;
    const initial = fallback < minimum ? minimum : fallback > maximum ? maximum : fallback;
    setYearText(initial.slice(0, 4));
    setActiveMonth(Number(initial.slice(5)) - 1);
    restore.current = true;
    setOpen(true);
  }
  function commit(month: string) {
    if (month && !allowed(month)) return;
    setLocal(month);
    setInvalid(false);
    restore.current = true;
    emitControlValue(native.current, month);
    setOpen(false);
  }
  function navigate(offset: number) {
    const date = new Date(0);
    date.setUTCFullYear(year, activeMonth + offset, 15);
    const candidate = `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!allowed(candidate)) return;
    focusGrid.current = true;
    setYearText(candidate.slice(0, 4));
    setActiveMonth(date.getUTCMonth());
  }
  useLayoutEffect(() => {
    if (open && validYear && !allowed(stamp(activeMonth))) {
      const firstAllowed = monthNames.findIndex((_, index) => allowed(stamp(index)));
      if (firstAllowed >= 0) {
        setActiveMonth(firstAllowed);
        return;
      }
    }
    if (open && focusGrid.current) {
      active.current?.focus({ preventScroll: true });
      focusGrid.current = false;
    }
  }, [open, yearText, activeMonth]);
  return (
    <span className={`month-field ${className}`}>
      <button
        type="button"
        ref={trigger}
        id={fieldId}
        className="month-trigger"
        data-control-trigger="true"
        data-control="month"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${generated}-popup` : undefined}
        aria-required={required}
        aria-invalid={props['aria-invalid'] ?? invalid}
        aria-describedby={props['aria-describedby']}
        data-value={selected}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show();
          }
        }}
      >
        <span>
          {selected
            ? `${monthNames[Number(selected.slice(5)) - 1]} ${selected.slice(0, 4)}`
            : 'Escolher mês'}
        </span>
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      <input
        {...props}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        aria-label={undefined}
        aria-labelledby={undefined}
        data-native-control="month"
        ref={native}
        id={`${fieldId}-native`}
        type="month"
        value={value ?? local}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={onChange}
        onInvalid={(event) => {
          onInvalid?.(event);
          event.preventDefault();
          setInvalid(true);
          show();
          trigger.current?.focus();
        }}
      />
      <ControlPopover
        open={open}
        onOpenChange={setOpen}
        anchor={trigger}
        restoreFocus={restore}
        label={`Selecionar mês: ${label}`}
        className="month-popover"
        onReady={(element) =>
          element.querySelector<HTMLElement>('[data-active="true"]')?.focus({ preventScroll: true })
        }
      >
        <div id={`${generated}-popup`} className="calendar-header">
          <button
            type="button"
            className="icon-button"
            aria-label="Ano anterior"
            disabled={!validYear || year <= minYear}
            onClick={() => setYearText(String(year - 1))}
          >
            <ChevronLeft size={17} />
          </button>
          <label className="calendar-year">
            <span className="sr-only">Ano</span>
            <input
              aria-label="Ano"
              inputMode="numeric"
              value={yearText}
              onChange={(event) => {
                if (/^\d{0,4}$/.test(event.target.value)) setYearText(event.target.value);
              }}
              aria-invalid={!validYear}
              onBlur={() => {
                if (!validYear) setYearText(fallback.slice(0, 4));
              }}
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Próximo ano"
            disabled={!validYear || year >= maxYear}
            onClick={() => setYearText(String(year + 1))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div
          className="month-grid"
          role="group"
          aria-label={`Meses de ${validYear ? year : ''}`}
          onKeyDown={(event) => {
            const offsets: Record<string, number> = {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -3,
              ArrowDown: 3,
              PageUp: -12,
              PageDown: 12,
              Home: -activeMonth,
              End: 11 - activeMonth,
            };
            if (event.key in offsets) {
              event.preventDefault();
              navigate(offsets[event.key]);
            }
          }}
        >
          {monthNames.map((name, index) => {
            const month = stamp(index);
            return (
              <button
                type="button"
                ref={index === activeMonth ? active : undefined}
                key={name}
                aria-label={`${name} de ${yearText}`}
                aria-pressed={selected === month}
                data-active={index === activeMonth}
                data-month={month}
                tabIndex={index === activeMonth ? 0 : -1}
                disabled={!validYear || !allowed(month)}
                onFocus={() => setActiveMonth(index)}
                onClick={() => commit(month)}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="calendar-footer">
          {clearable && (
            <button type="button" className="text-button" onClick={() => commit('')}>
              Limpar
            </button>
          )}
          <button
            type="button"
            className="text-button"
            disabled={!allowed(dateToday().slice(0, 7))}
            onClick={() => commit(dateToday().slice(0, 7))}
          >
            Este mês
          </button>
        </div>
      </ControlPopover>
    </span>
  );
}
