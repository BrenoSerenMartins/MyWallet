/** Map provider errors to safe, useful copy rather than displaying URL-supplied text. */
export function authReturnError(search: string, hash: string): string | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const get = (key: string) => query.get(key) || fragment.get(key);
  if (!get('error') && !get('error_code') && !get('error_description')) return null;
  if (get('error_code') === 'otp_expired')
    return 'Este link expirou, já foi utilizado ou é inválido. Solicite um novo e abra o e-mail mais recente no mesmo navegador.';
  return 'Não foi possível validar o link de acesso. Solicite um novo e tente novamente no mesmo navegador.';
}
