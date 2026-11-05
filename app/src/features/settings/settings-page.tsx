import { Select } from '../../shared/ui/controls/select';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { authClient } from '../../shared/api/auth-client';
import { Button, ThemeSwitcher } from '../../shared/ui/primitives';
import { DataSettings } from './data-settings';
export function SettingsPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = ['appearance', 'data', 'account'].includes(params.get('view') ?? '')
    ? params.get('view')!
    : 'appearance';
  const setView = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'appearance') next.delete('view');
    else next.set('view', value);
    setParams(next);
  };

  return (
    <div className="page-enter settings-page">
      <h1 className="sr-only">Preferências</h1>
      <label className="workspace-section-select">
        <span className="sr-only">Seções de preferências</span>
        <Select
          aria-label="Seções de preferências"
          value={view}
          onChange={(event) => setView(event.target.value)}
        >
          <option value="appearance">Aparência</option>
          <option value="data">Dados e backup</option>
          <option value="account">Conta</option>
        </Select>
      </label>
      <div className="view-content">
        {view === 'appearance' && (
          <>
            <section className="panel settings-panel">
              <h2 className="sr-only">Aparência</h2>
              <div className="settings-info">
                <ThemeSwitcher expanded />
                <p>
                  O modo sistema acompanha seu dispositivo. Sua escolha fica salva neste navegador.
                </p>
              </div>
            </section>
          </>
        )}
        {view === 'data' && <DataSettings />}
        {view === 'account' && (
          <section className="panel settings-panel">
            <div className="section-heading">
              <div>
                <h2>
                  <ShieldCheck size={18} />
                  Sua conta
                </h2>
                <p>{session?.user.email}</p>
              </div>
            </div>
            <div className="settings-info">
              <Button className="secondary" onClick={() => void authClient.auth.signOut()}>
                Sair da conta
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
