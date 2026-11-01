import { BadRequestException } from '@nestjs/common';
import { dateOnly, exactAmount } from '../../../core/rest/index.js';
import type { CommitmentSchedule } from '../../../core/integration/index.js';
export function commitmentToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function monthEnd(month: string) {
  dateOnly(`${month}-01`);
  if (!/^\d{4}-\d{2}$/.test(month) || month < '1900-01' || month > '9998-12')
    throw new BadRequestException('Mês inválido.');
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
    .toISOString()
    .slice(0, 10);
}
export function dueDates(schedule: CommitmentSchedule, through: string): string[] {
  const end = [through, schedule.endDate ?? through].sort()[0];
  if (schedule.startDate > end) return [];
  if (schedule.frequency === 'once')
    return !schedule.endedOn || schedule.startDate < schedule.endedOn ? [schedule.startDate] : [];
  const result: string[] = [];
  const day = Number(schedule.startDate.slice(8));
  for (
    let year = Number(schedule.startDate.slice(0, 4)),
      month = Number(schedule.startDate.slice(5, 7));
    ;
  ) {
    const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    if (`${prefix}-01` > end) break;
    const date = `${prefix}-${String(Math.min(day, Number(monthEnd(prefix).slice(8)))).padStart(2, '0')}`;
    if (date >= schedule.startDate && date <= end && (!schedule.endedOn || date < schedule.endedOn))
      result.push(date);
    if (schedule.endedOn && date >= schedule.endedOn) break;
    month++;
    if (month === 13) {
      month = 1;
      year++;
    }
  }
  return result;
}
export function sumAmounts(values: number[]) {
  return exactAmount(Number(values.reduce((sum, value) => sum + BigInt(value), 0n)));
}
