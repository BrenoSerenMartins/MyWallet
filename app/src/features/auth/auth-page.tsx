import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { authClient } from '../../shared/api/auth-client';
import { Button, Logo, ThemeSwitcher } from '../../shared/ui/primitives';
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
  const [message, setMessage] = useState('');
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
    <div className="auth-page">
      <section className="auth-story">
        <Logo />
        <div className="story-content">
          <span className="eyebrow">
            <span className="status-dot" /> SUA VIDA FINANCEIRA, POR INTEIRO
          </span>
          <h1>
            Mais clareza.
            <br />
            Mais possibilidades.
            <br />
            <span>Mais você.</span>
          </h1>
          <p>Um lugar para organizar o presente e dar espaço aos seus próximos planos.</p>
          <div className="story-orbit">
            <div className="orbit-ring one" />
            <div className="orbit-ring two" />
            <div className="orbit-center">
              <Layers3 size={54} />
            </div>
            <span className="orbit-label">
              <Sparkles size={16} /> Tudo conectado
            </span>
            <span className="orbit-label secondary">
              <Check size={16} /> Cada movimento importa
            </span>
          </div>
        </div>
        <p className="story-footer">
          Seu dinheiro merece uma visão mais clara. <ArrowUpRight size={16} />
        </p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-top">
          <span className="mobile-logo">
            <Logo />
          </span>
          <ThemeSwitcher />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">BEM-VINDO AO MYWALLET</span>
          <h2>{title}</h2>
          <p className="muted">
            {mode === 'sign-in'
              ? 'Entre para acompanhar o que importa para você.'
              : mode === 'sign-up'
                ? 'Crie sua conta e comece a organizar suas finanças.'
                : 'Siga as instruções para acessar sua conta.'}
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode !== 'reset' && (
              <label>
                E-mail
                <input
                  type="email"
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
                <div className="password-field">
                  <input
                    type={visible ? 'text' : 'password'}
                    minLength={8}
                    required
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Pelo menos 8 caracteres"
                  />
                  <button
                    type="button"
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
                className="text-button recover-link"
                type="button"
                onClick={() => {
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
            {message && (
              <p role="status" className="form-success">
                {message}
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
          <p className="auth-switch">
            {mode === 'sign-in' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}{' '}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setError('');
                setMessage('');
              }}
            >
              {mode === 'sign-in' ? 'Começar agora' : 'Entrar'}
            </button>
          </p>
          <div className="auth-assurance">
            <ShieldCheck size={18} />
            <span>Suas finanças em um espaço só seu.</span>
          </div>
        </div>
        <p className="auth-bottom">MyWallet · Finanças pessoais com intenção.</p>
      </section>
    </div>
  );
}
