import { useNotifications } from '../../shared/feedback/notification-provider';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authClient } from '../../shared/api/auth-client';
import { Button, Logo, ThemeSwitcher } from '../../shared/ui/primitives';
import { productName } from '../../shared/brand';
import './auth.css';
export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'recover' | 'reset'>(
    location.pathname === '/reset-password' ? 'reset' : 'sign-in',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const notices = useNotifications('session');
  const setMessage = (message: string) => {
    if (message) notices.info(message, { id: 'auth-feedback', duration: 0 });
    else notices.dismiss('auth-feedback');
  };
  const [error, setError] = useState('');
  useEffect(() => {
    if (location.pathname === '/auth/callback') {
      void authClient.auth.getSession().then(({ data }) => {
        if (data.session) navigate('/', { replace: true });
      });
    }
  }, [location.pathname, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      let result;
      if (mode === 'sign-in')
        result = await authClient.auth.signInWithPassword({ email, password });
      else if (mode === 'sign-up')
        result = await authClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + '/auth/callback' },
        });
      else if (mode === 'recover')
        result = await authClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
      else result = await authClient.auth.updateUser({ password });
      if (result.error) throw new Error(result.error.message);
      if (mode === 'recover')
        setMessage('Se houver uma conta com este e-mail, você receberá as instruções.');
      else if (
        mode === 'sign-up' &&
        'data' in result &&
        !('session' in (result.data ?? {}) && (result.data as { session?: unknown })?.session)
      )
        setMessage('Confira seu e-mail para confirmar o cadastro.');
      else navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }
  const title = {
    'sign-in': 'Entrar na sua conta',
    'sign-up': 'Seu próximo passo começa aqui.',
    recover: 'Vamos recuperar seu acesso.',
    reset: 'Uma nova senha para você.',
  }[mode];
  return (
    <div className="auth-entry">
      <header className="entry-header">
        <Link to="/" className="text-button">
          ← Voltar ao início
        </Link>
        <div className="entry-tools">
          <ThemeSwitcher />
        </div>
      </header>
      <main className="entry-main" id="main-content">
        <Link to="/" className="entry-brand" aria-label={`${productName} — início`}>
          <Logo />
        </Link>
        <section className="entry-access" aria-labelledby="entry-form-title">
          <div className="entry-form-wrap">
            <h1 id="entry-form-title" className={mode === 'sign-in' ? 'sr-only' : undefined}>
              {title}
            </h1>
            {(mode === 'recover' || mode === 'reset') && (
              <p className="entry-form-description">
                {mode === 'recover'
                  ? 'Receba as instruções no seu e-mail.'
                  : 'Use pelo menos 8 caracteres.'}
              </p>
            )}
            <form onSubmit={submit} className="form-stack entry-form">
              {mode !== 'reset' && (
                <label>
                  E-mail
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                  />
                </label>
              )}
              {mode !== 'recover' && (
                <label>
                  Senha
                  <div className="entry-password">
                    <input
                      type={visible ? 'text' : 'password'}
                      minLength={8}
                      required
                      autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'sign-in' ? 'Sua senha' : 'Pelo menos 8 caracteres'}
                    />
                    <button
                      type="button"
                      aria-pressed={visible}
                      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {mode === 'sign-in' && (
                <button
                  className="text-button entry-recover"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setVisible(false);
                    setMode('recover');
                    setError('');
                  }}
                >
                  Esqueci minha senha
                </button>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}

              <Button disabled={busy}>
                {busy
                  ? 'Aguarde…'
                  : mode === 'sign-in'
                    ? 'Entrar na minha conta'
                    : mode === 'sign-up'
                      ? 'Criar minha conta'
                      : mode === 'recover'
                        ? 'Enviar instruções'
                        : 'Salvar nova senha'}
                <ArrowRight size={18} />
              </Button>
            </form>
            <p className="entry-switch">
              {mode === 'sign-in' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}{' '}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setVisible(false);
                  setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                  setError('');
                  setMessage('');
                }}
              >
                {mode === 'sign-in' ? 'Começar agora' : 'Entrar'}
              </button>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
