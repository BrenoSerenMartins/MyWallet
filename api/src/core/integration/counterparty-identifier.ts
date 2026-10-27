export function normalizeCounterpartyIdentifier(
  value: string,
  kind: 'description' | 'store_id' = 'description',
) {
  if (kind === 'store_id') return value.trim();
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
export function isSpecificCounterpartyIdentifier(
  value: string,
  kind: 'description' | 'store_id' = 'description',
) {
  if (kind === 'store_id') return value.trim().length > 0 && value.trim().length <= 100;
  const normalized = normalizeCounterpartyIdentifier(value);
  return (
    normalized.length >= 3 &&
    !/^(?:mercado pago[ ·:-]*)?(?:settlement(?:_shipping)?|payouts?|cashback|credit|refund|dispute|withdrawal|pix (?:enviado|recebido)|transferência|pagamento|rendimento)s?$/.test(
      normalized,
    )
  );
}
