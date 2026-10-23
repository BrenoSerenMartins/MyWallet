import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, ShieldCheck, FolderTree, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { authClient } from '../../shared/api/auth-client';
import { Button, ThemeSwitcher } from '../../shared/ui/primitives';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { DataSettings } from './data-settings';
export function SettingsPage() {
  const { session } = useAuth();
  const [view, setView] = useState('appearance');
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>Preferências</h1>
          <p>Seu espaço, suas escolhas e seus dados.</p>
        </div>
      </div>
      <ViewSwitcher
        label="Seções de preferências"
        value={view}
        onChange={setView}
        options={[
          { value: 'appearance', label: 'Aparência' },
          { value: 'data', label: 'Dados e backup' },
          { value: 'account', label: 'Conta' },
        ]}
      />
      <div className="view-content">
        {view === 'appearance' && (
          <>
            <section className="panel settings-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    <Palette size={18} />
                    Aparência
                  </h2>
                  <p>Escolha como prefere enxergar seu espaço.</p>
                </div>
                <ThemeSwitcher />
              </div>
              <div className="settings-info">
                <strong>Claro, escuro ou automático.</strong>
                <p>
                  O modo sistema acompanha seu dispositivo. Sua escolha fica salva neste navegador.
                </p>
              </div>
            </section>
            <Link to="/categories" className="panel settings-shortcut">
              <FolderTree size={22} />
              <span>
                <strong>Grupos e categorias</strong>
                <small>Organize Casa, Alimentação e cada detalhe.</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
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
              <strong>Seus espaços financeiros.</strong>
              <p>As informações ficam isoladas por espaço e pertencem à sua conta.</p>
              <Link to="/workspaces" className="button secondary">
                Gerenciar espaços
              </Link>
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
