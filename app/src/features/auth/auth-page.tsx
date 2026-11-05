import { useNotifications } from '../../shared/feedback/notification-provider';
import { NotificationCenter } from '../../shared/feedback/notification-center';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowDownLeft,
  CalendarDays,
  ChartNoAxesCombined,
} from 'lucide-react';
import { authClient } from '../../shared/api/auth-client';
import { Button, Logo, ThemeSwitcher } from '../../shared/ui/primitives';
import { productName, productTagline } from '../../shared/brand';
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
    'sign-in': 'Bom ter você por aqui.',
    'sign-up': 'Seu próximo passo começa aqui.',
    recover: 'Vamos recuperar seu acesso.',
    reset: 'Uma nova senha para você.',
  }[mode];
  return (
    <div className="auth-entry">
      <header className="entry-header">
        <a href="/" className="entry-brand" aria-label={`${productName} — início`}>
          <Logo />
        </a>
        <span className="entry-header-note">Um novo olhar para o seu dinheiro.</span>
        <NotificationCenter />
      </header>
      <main className="entry-main">
        <section className="entry-story" aria-labelledby="entry-story-title">
          <span className="entry-eyebrow">
            <span aria-hidden="true" /> CLAREZA PARA SEGUIR EM FRENTE
          </span>
          <h1 id="entry-story-title">
            Seu dinheiro,
            <br />
            <em>com direção.</em>
          </h1>
          <p className="entry-intro">
            Entenda o presente.
            <br className="entry-desktop-break" /> Dê espaço aos seus próximos planos.
          </p>
          <div className="entry-visual" aria-hidden="true">
            <svg viewBox="0 0 560 150" fill="none">
              <path
                className="entry-chart-grid"
                d="M0 30H560M0 75H560M0 120H560M80 0V150M200 0V150M320 0V150M440 0V150"
              />
              <path
                className="entry-chart-area"
                d="M0 130C45 130 54 92 100 100S166 132 214 95S270 112 316 64S380 88 420 43S506 58 560 10V150H0Z"
              />
              <path
                className="entry-chart-line"
                d="M0 130C45 130 54 92 100 100S166 132 214 95S270 112 316 64S380 88 420 43S506 58 560 10"
              />
              <circle cx="420" cy="43" r="5" className="entry-chart-point" />
            </svg>
            <div className="entry-visual-caption">
              <span>Menos ruído.</span>
              <span>
                Mais possibilidades. <ArrowRight size={14} />
              </span>
            </div>
          </div>
          <ul className="entry-features">
            <li>
              <ArrowDownLeft size={19} aria-hidden="true" />
              <span>
                <strong>Suas contas</strong>
                <small>Cada movimento, no seu lugar.</small>
              </span>
            </li>
            <li>
              <CalendarDays size={19} aria-hidden="true" />
              <span>
                <strong>Seu mês</strong>
                <small>Um plano que acompanha você.</small>
              </span>
            </li>
            <li>
              <ChartNoAxesCombined size={19} aria-hidden="true" />
              <span>
                <strong>Seus próximos passos</strong>
                <small>Patrimônio com perspectiva.</small>
              </span>
            </li>
          </ul>
        </section>
        <section className="entry-access" aria-labelledby="entry-form-title">
          <div className="entry-form-wrap">
            <span className="entry-eyebrow">
              {mode === 'sign-in'
                ? 'SEU ESPAÇO'
                : mode === 'sign-up'
                  ? 'COMECE POR AQUI'
                  : 'CUIDANDO DO SEU ACESSO'}
            </span>
            <h2 id="entry-form-title">{title}</h2>
            <p className="entry-form-description">
              {mode === 'sign-in'
                ? 'Entre para continuar de onde você parou.'
                : mode === 'sign-up'
                  ? 'Crie sua conta e organize o que vem pela frente.'
                  : mode === 'recover'
                    ? 'Informe seu e-mail para receber as instruções de recuperação.'
                    : 'Escolha uma senha com pelo menos 8 caracteres.'}
            </p>
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
            <div className="entry-assurance">
              <ShieldCheck size={18} />
              <span>Você no controle, um mês de cada vez.</span>
            </div>
          </div>
        </section>
      </main>
      <footer className="entry-footer">
        <span>
          {productName}
          <span aria-hidden="true"> · </span>
          <span className="entry-footer-tagline">{productTagline}</span>
        </span>
        <ThemeSwitcher />
      </footer>
    </div>
  );
}
