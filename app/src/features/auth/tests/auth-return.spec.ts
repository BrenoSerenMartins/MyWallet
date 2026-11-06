import { expect, it } from 'vitest';
import { authReturnError } from '../auth-return';
it('recognizes expired email links in query strings and fragments', () => {
  for (const [search, hash] of [
    ['?error=access_denied&error_code=otp_expired', ''],
    ['', '#error=access_denied&error_code=otp_expired'],
    ['?error_code=otp_expired', '#error=access_denied'],
  ])
    expect(authReturnError(search, hash)).toContain('Solicite um novo');
});
it('does not trust provider descriptions or mistake valid codes for errors', () => {
  expect(authReturnError('?code=valid-code', '')).toBeNull();
  expect(authReturnError('?cadastro=1', '')).toBeNull();
  expect(authReturnError('', '#access_token=token&type=recovery')).toBeNull();
  const message = authReturnError('?error_description=untrusted-message', '');
  expect(message).not.toContain('untrusted-message');
  expect(message).toContain('Não foi possível validar');
});
