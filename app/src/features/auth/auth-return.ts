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

export function authInitializationError(error: { code?: string; name?: string }): string {
  if (error.code === 'otp_expired' || error.code === 'flow_state_expired')
    return 'Este link de recuperação expirou ou já foi utilizado. Solicite um novo e-mail.';
  if (error.name === 'AuthPKCECodeVerifierMissingError' || error.code === 'bad_code_verifier')
    return 'O pedido de recuperação não foi encontrado neste navegador. Faça um novo pedido por este site e abra somente o último e-mail recebido.';
  if (error.code === 'flow_state_not_found')
    return 'O pedido de recuperação não está mais disponível. Solicite um novo e-mail e use apenas o link mais recente.';
  if (error.name === 'AuthRetryableFetchError')
    return 'Não foi possível conectar ao serviço de autenticação. Confira sua conexão e tente abrir o link novamente.';
  return 'A confirmação do e-mail não pôde ser concluída. Solicite um novo link de recuperação.';
}

export function authEmailLimitMessage(error: { code?: string; message?: string }): string | null {
  if (error.code === 'over_email_send_rate_limit' || error.message === 'email rate limit exceeded')
    return 'O limite de envio de e-mails foi atingido. Aguarde a liberação do serviço antes de pedir outro link. Nenhum novo e-mail foi enviado nesta tentativa.';
  if (error.code === 'over_request_rate_limit')
    return 'Foram feitas muitas solicitações. Aguarde um pouco antes de tentar novamente.';
  return null;
}
