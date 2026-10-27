export function normalizeCounterpartyIdentifier(
  value: string,
  kind: 'description' | 'store_id' = 'description',
) {
  if (kind === 'store_id') return value.trim();
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
// Comparison only. Keep original descriptions and stored alias keys unchanged.
export function comparableCounterpartyIdentifier(
  value: string,
  kind: 'description' | 'store_id' = 'description',
) {
  if (kind === 'store_id') return value.trim();
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function isSpecificCounterpartyIdentifier(
  value: string,
  kind: 'description' | 'store_id' = 'description',
) {
  if (kind === 'store_id') return value.trim().length > 0 && value.trim().length <= 100;
  const normalized = comparableCounterpartyIdentifier(value);
  return (
    normalized.length >= 3 &&
    !/^(?:mercado pago )?(?:settlement(?: shipping)?|payouts?|cashback|credit|refund|dispute|withdrawal|pix (?:enviado|recebido)|transferencia|pagamento|rendimento)s?$/.test(
      normalized,
    )
  );
}
