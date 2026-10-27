import { UnprocessableEntityException } from '@nestjs/common';
import { dateOnly } from '../../../../core/rest/index.js';
import type { SettlementMetadata } from '../../contracts/statement.js';
import type { StatementCell } from './tabular-statement.parser.js';
import { parseDecimalAmount } from './statement-values.js';
export interface SettlementSourceRow {
  sourceRow: number;
  sourceOperationId: string;
  description: string | null;
  metadata: SettlementMetadata;
}
const required = [
  'TRANSACTION_DATE',
  'SETTLEMENT_DATE',
  'SOURCE_ID',
  'TRANSACTION_TYPE',
  'TRANSACTION_AMOUNT',
  'TRANSACTION_CURRENCY',
  'SETTLEMENT_NET_AMOUNT',
  'SETTLEMENT_CURRENCY',
];
export function isSettlementHeader(row: StatementCell[]) {
  return row.includes('SOURCE_ID') && row.includes('SETTLEMENT_NET_AMOUNT');
}
function timestamp(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new UnprocessableEntityException('Data/hora da liquidação inválida ou sem fuso horário.');
  dateOnly(value.slice(0, 10));
  return value;
}
function optionalNumber(value: string) {
  if (!value) return null;
  if (!/^\d{1,3}$/.test(value) || Number(value) < 1)
    throw new UnprocessableEntityException('Parcelamento inválido no relatório.');
  return Number(value);
}
function metadata(get: (name: string) => string): SettlementMetadata {
  const transactionTimestamp = timestamp(get('TRANSACTION_DATE'));
  const settlementTimestamp = timestamp(get('SETTLEMENT_DATE'));
  for (const [key, date] of [
    ['TRANSACTION_DATE_SHORT', transactionTimestamp],
    ['SETTLEMENT_DATE_SHORT', settlementTimestamp],
  ])
    if (get(key) && get(key) !== date.slice(0, 10))
      throw new UnprocessableEntityException(
        'As datas curtas e completas da liquidação não conferem.',
      );
  if (get('TRANSACTION_CURRENCY') !== 'BRL' || get('SETTLEMENT_CURRENCY') !== 'BRL')
    throw new UnprocessableEntityException('Este relatório deve usar BRL.');
  const installments = optionalNumber(get('INSTALLMENTS')),
    installmentNumber = optionalNumber(get('INSTALLMENT_NUMBER'));
  if (installments && installmentNumber && installmentNumber > installments)
    throw new UnprocessableEntityException('Parcela maior que o total de parcelas.');
  const lastFourDigits = get('LAST_FOUR_DIGITS') || null;
  if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits))
    throw new UnprocessableEntityException('Últimos quatro dígitos inválidos.');
  const optionalAmount = (name: string) => (get(name) ? parseDecimalAmount(get(name)) : null);
  const released = get('IS_RELEASED').toLowerCase();
  if (released && !['true', 'false'].includes(released))
    throw new UnprocessableEntityException('Indicador de liberação inválido.');
  const releaseTimestamp = get('MONEY_RELEASE_DATE') ? timestamp(get('MONEY_RELEASE_DATE')) : null;
  if (get('MONEY_RELEASE_DATE_SHORT')) {
    dateOnly(get('MONEY_RELEASE_DATE_SHORT'));
    if (releaseTimestamp && get('MONEY_RELEASE_DATE_SHORT') !== releaseTimestamp.slice(0, 10))
      throw new UnprocessableEntityException('As datas de liberação não conferem.');
  }
  const storeName = get('STORE_NAME'),
    storeId = get('STORE_ID');
  if (storeName.length > 200 || storeId.length > 100)
    throw new UnprocessableEntityException('Identificação da loja fora dos limites.');
  return {
    ...(storeName ? { storeName } : {}),
    ...(storeId ? { storeId } : {}),
    isReleased: released ? released === 'true' : null,
    releaseTimestamp,
    installmentNetAmount: optionalAmount('INSTALLMENT_NET_AMOUNT'),
    eventType: get('TRANSACTION_TYPE'),
    transactionTimestamp,
    settlementTimestamp,
    currency: 'BRL',
    grossAmount: parseDecimalAmount(get('TRANSACTION_AMOUNT')),
    netAmount: parseDecimalAmount(get('SETTLEMENT_NET_AMOUNT')),
    realAmount: optionalAmount('REAL_AMOUNT'),
    fees: optionalAmount('FEE_AMOUNT'),
    taxes: optionalAmount('TAXES_AMOUNT'),
    paymentMethod: get('PAYMENT_METHOD') || null,
    paymentMethodType: get('PAYMENT_METHOD_TYPE') || null,
    brand: get('FRANCHISE') || null,
    installments,
    installmentNumber,
    lastFourDigits,
  };
}
export function parseSettlementTable(rows: StatementCell[][]): SettlementSourceRow[] {
  const headers = rows[0]?.map((cell) => (typeof cell === 'string' ? cell.trim() : '')) ?? [];
  if (
    required.some((name) => !headers.includes(name)) ||
    new Set(headers).size !== headers.length ||
    rows.length > 10001
  )
    throw new UnprocessableEntityException(
      'Cabeçalho settlement_v2 inválido ou relatório fora dos limites.',
    );
  const records = rows.slice(1).flatMap((row, index) => {
    if (row.every((cell) => cell === null || cell === '')) return [];
    if (row.length !== headers.length)
      throw new UnprocessableEntityException(
        `Linha ${index + 2} incompleta no relatório de liquidações.`,
      );
    const get = (name: string) => {
      const value = row[headers.indexOf(name)];
      if (value == null) return '';
      if (typeof value !== 'string')
        throw new UnprocessableEntityException('Tipo de célula não suportado em settlement_v2.');
      return value.trim();
    };
    const sourceOperationId = get('SOURCE_ID'),
      eventType = get('TRANSACTION_TYPE');
    if (
      !sourceOperationId ||
      sourceOperationId.length > 160 ||
      !eventType ||
      eventType.length > 100
    )
      throw new UnprocessableEntityException('Referência ou tipo da operação inválido.');
    const description = get('DESCRIPTION') || null;
    if (description && description.length > 500)
      throw new UnprocessableEntityException('Descrição muito longa.');
    return [{ sourceRow: index + 2, sourceOperationId, description, metadata: metadata(get) }];
  });
  if (!records.length)
    throw new UnprocessableEntityException(
      'Este relatório contém apenas o cabeçalho, sem transações para importar. Gere outro relatório no Mercado Pago com um período que contenha movimentações.',
    );
  return records;
}
