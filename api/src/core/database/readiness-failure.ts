const visibleCodes = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  '28P01',
  '28000',
  '3D000',
  '53300',
  '57P03',
]);

export function databaseReadinessFailure(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' && visibleCodes.has(code)) return code;
  }
  if (error instanceof Error && /timeout|timed out/i.test(error.message)) return 'TIMEOUT';
  return 'CONNECTION_FAILED';
}
