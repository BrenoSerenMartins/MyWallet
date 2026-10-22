import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { parseMercadoPagoPages, parseAmount } from '../parsers/mercado-pago/statement.parser.js';
import { mapMercadoPago } from '../mappers/mercado-pago/statement.mapper.js';
const row = (y: number, amount: string, balance: string, description = 'Pagamento') => [
  { text: '01-10-2026', x: 41, y },
  { text: description, x: 89, y: y + 6 },
  { text: 'same-reference', x: 198, y },
  { text: amount, x: 300, y },
  { text: balance, x: 380, y },
];
const first = [
  { text: 'EXTRATO DE CONTA', x: 329, y: 594 },
  { text: 'Mercado Pago Instituição', x: 40, y: 10 },
  { text: 'Saldo inicial:', x: 44, y: 519 },
  { text: '100,00', x: 88, y: 519 },
  { text: 'Saldo final:', x: 333, y: 518 },
  { text: '95,10', x: 372, y: 518 },
  ...row(413, '- 5,00', '95,00'),
  { text: 'com descrição em outra linha', x: 89, y: 407 },
  ...row(380, '0,10', '95,10', 'Rendimentos'),
];
describe('Mercado Pago source contract', () => {
  it('parses localized money without floating arithmetic', () => {
    expect(parseAmount('- 1.234,56')).toBe(-123456);
    expect(parseAmount('R$ 0,01')).toBe(1);
    expect(() => parseAmount('12,345')).toThrow();
  });
  it('reconstructs descriptions and preserves rows with identical references', () => {
    const statement = parseMercadoPagoPages([first]);
    expect(statement.items).toHaveLength(2);
    expect(statement.items[0].description).toBe('Pagamento com descrição em outra linha');
    expect(statement.items[0].sourceOperationId).toBe(statement.items[1].sourceOperationId);
    expect(mapMercadoPago(statement).map((i) => i.transactionType)).toEqual([
      'unclassified',
      'income',
    ]);
  });
  it('treats reserve deposits and withdrawals as transfers', () => {
    const statement = parseMercadoPagoPages([first]);
    statement.items[0].description = 'Dinheiro reservado Emergências';
    expect(mapMercadoPago(statement)[0].transactionType).toBe('transfer');
    statement.items[0].description = 'Dinheiro retirado Emergências';
    expect(mapMercadoPago(statement)[0].transactionType).toBe('transfer');
  });
  it('refuses unrecognized or non-reconciling layouts', () => {
    expect(() => parseMercadoPagoPages([])).toThrow();
    expect(() =>
      parseMercadoPagoPages([first.map((c) => (c.text === '95,00' ? { ...c, text: '96,00' } : c))]),
    ).toThrow('saldo');
  });
});
