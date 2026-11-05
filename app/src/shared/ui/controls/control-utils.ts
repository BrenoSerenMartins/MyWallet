import { useLayoutEffect, useState, type RefObject } from 'react';

/** Keep original form handlers, native constraint validation and submitted values. */
export function emitControlValue(
  element: HTMLInputElement | HTMLSelectElement | null,
  value: string,
) {
  if (!element) return;
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
export function useControlLabel(ref: RefObject<HTMLElement | null>, explicit?: string) {
  const [label, setLabel] = useState(explicit ?? 'Selecionar');
  useLayoutEffect(() => {
    if (explicit) {
      setLabel(explicit);
      return;
    }
    const parent = ref.current?.closest('label');
    if (!parent) return;
    const copy = parent.cloneNode(true) as HTMLElement;
    copy
      .querySelectorAll(
        'button, input, select, textarea, svg, [aria-hidden="true"], [role="alert"], .control-field-error',
      )
      .forEach((node) => node.remove());
    const text = copy.textContent?.replace(/\s+/g, ' ').trim();
    if (text) setLabel(text);
  });
  return explicit ?? label;
}
export function isoDate(year: number, monthIndex: number, day: number) {
  const date = new Date(0);
  date.setUTCHours(12);
  date.setUTCFullYear(year, monthIndex, day);
  return date.toISOString().split('T')[0];
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function displayDate(value: string) {
  return validDate(value) ? value.split('-').reverse().join('/') : '';
}
export function parseDate(value: string) {
  if (validDate(value)) return value;
  if (!/^(?:\d{2}\/\d{2}\/\d{4}|\d{8})$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const iso = `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  return validDate(iso) ? iso : null;
}
export const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
