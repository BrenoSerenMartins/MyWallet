import { BadRequestException } from '@nestjs/common';
export function planningPeriod(month: string) {
  if (!/^(?:19\d{2}|[2-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(month) || month.startsWith('9999'))
    throw new BadRequestException('Informe um mês válido entre 1900 e 9998.');
  const [year, number] = month.split('-').map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10),
    previous: new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7),
  };
}
