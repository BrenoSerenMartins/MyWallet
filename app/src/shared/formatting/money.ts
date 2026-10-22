const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (minor: number) => formatter.format(minor / 100);
export const shortDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(date + 'T12:00:00'),
  );
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(/R\$|\s/g, '');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})*)(?:,\d{1,2})?$/.test(normalized))
    throw new Error('Informe um valor como 150,00.');
  const [whole, fraction = ''] = normalized.replaceAll('.', '').split(',');
  const sign = whole.startsWith('-') ? -1 : 1;
  const minor = sign * (Number(whole.replace('-', '')) * 100 + Number(fraction.padEnd(2, '0')));
  if (!Number.isSafeInteger(minor)) throw new Error('Valor fora do limite.');
  return minor;
}
export const dateToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
