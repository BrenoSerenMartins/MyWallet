import { BadRequestException } from '@nestjs/common';
import { dateOnly } from '../../../core/rest/index.js';
export function validCardMonth(month: string) {
  if (!/^(?:19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(month) || month > '9998-12')
    throw new BadRequestException('Mês de fatura inválido.');
  return month;
}
export function shiftCardMonth(month: string, offset: number) {
  validCardMonth(month);
  const [y, m] = month.split('-').map(Number);
  return validCardMonth(new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7));
}
export function cardDay(month: string, day: number) {
  validCardMonth(month);
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, '0')}`;
}
export function billCalendar(month: string, closingDay: number, dueDay: number) {
  validCardMonth(month);
  const closingMonth = dueDay <= closingDay ? shiftCardMonth(month, -1) : month;
  return { closingDate: cardDay(closingMonth, closingDay), dueDate: cardDay(month, dueDay) };
}
export function firstBillMonth(date: string, closingDay: number, dueDay: number) {
  dateOnly(date);
  let closingMonth = validCardMonth(date.slice(0, 7));
  if (date >= cardDay(closingMonth, closingDay)) closingMonth = shiftCardMonth(closingMonth, 1);
  return dueDay <= closingDay ? shiftCardMonth(closingMonth, 1) : closingMonth;
}
export function splitInstallments(amount: number, count: number) {
  if (
    !Number.isSafeInteger(amount) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    amount < count
  )
    throw new BadRequestException('Valor insuficiente ou quantidade de parcelas inválida.');
  const base = Math.floor(amount / count);
  return Array.from({ length: count }, (_, i) => base + (i < amount % count ? 1 : 0));
}
export function financeToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
