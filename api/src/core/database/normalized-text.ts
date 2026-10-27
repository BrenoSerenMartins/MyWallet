// PostgreSQL counterpart of comparableCounterpartyIdentifier (description mode).
// Call only with static SQL expressions, never request input.
export function comparableTextSql(expression: string) {
  return `btrim(regexp_replace(lower(regexp_replace(normalize(${expression},NFKD), U&'[\\0300-\\036f]', '', 'g')), '[^[:alnum:]]+', ' ', 'g'))`;
}
