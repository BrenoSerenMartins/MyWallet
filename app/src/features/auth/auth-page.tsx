import { useNotifications } from '../../shared/feedback/notification-provider';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authReturnError, authInitializationError, authEmailLimitMessage } from './auth-return';
import { authClient, authStartup } from '../../shared/api/auth-client';
import { Button, Logo, ThemeSwitcher } from '../../shared/ui/primitives';
import { productName } from '../../shared/brand';
import './public-entry.css';
import './auth.css';
export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const invitation = new URLSearchParams(window.location.search).get('invite');
  if (invitation && /^[a-f0-9]{64}$/.test(invitation))
    sessionStorage.setItem('plannedwallet-pending-invite', invitation);
  const returnError = authReturnError(location.search, location.hash);
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'recover' | 'reset'>(
    returnError
      ? 'recover'
      : location.pathname === '/reset-password'
        ? 'reset'
        : new URLSearchParams(location.search).get('cadastro') === '1'
          ? 'sign-up'
          : 'sign-in',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(() => {
    try {
      const stored = Number(sessionStorage.getItem('plannedwallet-auth-email-retry-at'));
      return Number.isFinite(stored) && stored > Date.now()
        ? Math.min(stored, Date.now() + 60000)
        : 0;
    } catch {
      return 0;
    }
  });
  const [now, setNow] = useState(Date.now);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const emailMode = mode === 'recover' || mode === 'sign-up';
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) {
        setRetryAt(0);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  function pauseEmailRequests() {
    const current = Date.now();
    const next = current + 60000;
    setNow(current);
    setRetryAt(next);
    try {
      sessionStorage.setItem('plannedwallet-auth-email-retry-at', String(next));
    } catch {}
  }
  const notices = useNotifications('session');
  const setMessage = (message: string) => {
    if (message) notices.info(message, { id: 'auth-feedback', duration: 0 });
    else notices.dismiss('auth-feedback');
  };
  const [error, setError] = useState(returnError ?? '');
  const [resetReady, setResetReady] = useState(false);
  useEffect(() => {
    if (location.pathname !== '/reset-password' || returnError) return;
    let active = true;
    void (async () => {
      // initialize() retains callback errors; getSession() alone can silently return null.
      const initialization = await authStartup;
      if (!active) return;
      if (initialization.error) {
        setMode('recover');
        setError(authInitializationError(initialization.error));
        return;
      }
      const { data, error: sessionError } = await authClient.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) {
        setMode('recover');
        setError(
          sessionError
            ? authInitializationError(sessionError)
            : 'Este endereço não contém uma sessão de recuperação válida. Abra o botão de recuperação do e-mail mais recente ou solicite outro link.',
        );
      } else setResetReady(true);
    })();
    return () => {
      active = false;
    };
  }, [location.pathname, returnError]);
  useEffect(() => {
    if (location.pathname === '/auth/callback') {
      void authClient.auth.getSession().then(({ data }) => {
        if (data.session)
          navigate(
            sessionStorage.getItem('plannedwallet-pending-invite')
              ? `/workspaces?invite=${sessionStorage.getItem('plannedwallet-pending-invite')}`
              : '/',
            { replace: true },
          );
      });
    }
  }, [location.pathname, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (emailMode && retrySeconds > 0)) return;
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
      else {
        const { data, error: sessionError } = await authClient.auth.getSession();
        if (sessionError || !data.session) {
          setMode('recover');
          throw new Error('Seu acesso de recuperação expirou. Solicite um novo link.');
        }
        result = await authClient.auth.updateUser({ password });
      }
      if (result.error) {
        const limitMessage = emailMode ? authEmailLimitMessage(result.error) : null;
        if (limitMessage) {
          pauseEmailRequests();
          throw new Error(limitMessage);
        }
        throw result.error;
      }
      if (emailMode) pauseEmailRequests();
      if (mode === 'recover')
        setMessage(
          'Se houver uma conta com este e-mail, você receberá as instruções. Abra o e-mail mais recente no mesmo navegador em que fez o pedido.',
        );
      else if (
        mode === 'sign-up' &&
        'data' in result &&
        !('session' in (result.data ?? {}) && (result.data as { session?: unknown })?.session)
      )
        setMessage('Confira seu e-mail para confirmar o cadastro.');
      else
        navigate(
          sessionStorage.getItem('plannedwallet-pending-invite')
            ? `/workspaces?invite=${sessionStorage.getItem('plannedwallet-pending-invite')}`
            : '/',
          { replace: true },
        );
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
    <div className="auth-entry public-entry">
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
        <section className="entry-access public-surface" aria-labelledby="entry-form-title">
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

              <Button
                disabled={
                  busy || (emailMode && retrySeconds > 0) || (mode === 'reset' && !resetReady)
                }
              >
                {busy
                  ? 'Aguarde…'
                  : emailMode && retrySeconds > 0
                    ? `Aguarde ${retrySeconds}s`
                    : mode === 'sign-in'
                      ? 'Entrar na minha conta'
                      : mode === 'sign-up'
                        ? 'Criar minha conta'
                        : mode === 'recover'
                          ? 'Enviar instruções'
                          : 'Salvar nova senha'}
                <ArrowRight size={18} />
              </Button>
              {emailMode && retrySeconds > 0 && (
                <p className="field-help">
                  Pausa entre tentativas. O limite do serviço pode levar mais tempo para ser
                  liberado.
                </p>
              )}
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
