import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileJson, Palette, Plus, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { authClient } from '../../shared/api/auth-client';
import { jsonBody, request, requestBlob } from '../../shared/api/client';
import type { Category } from '../../shared/api/resources';
import { Button, ErrorState, Modal, ThemeSwitcher } from '../../shared/ui/primitives';
export function SettingsPage() {
  const { session } = useAuth();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [restore, setRestore] = useState<{
    id: string;
    accounts: number;
    transactions: number;
    monthlyPlans?: number;
  } | null>(null);
  const categories = useQuery({
    queryKey: [session?.user.id, 'categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  async function category(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/categories', {
        method: 'POST',
        body: jsonBody({ name, type, color: '#5ee9b5' }),
      });
      setOpen(false);
      setName('');
      void client.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  async function download(format: 'json' | 'csv') {
    setBusy(true);
    setError('');
    try {
      const url = URL.createObjectURL(await requestBlob(`/exports?format=${format}`));
      const a = document.createElement('a');
      a.href = url;
      a.download = `mywallet-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na exportação.');
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('O backup deve ter até 5 MB.');
      const preview = await request<{ id: string; accounts: number; transactions: number }>(
        '/restores',
        { method: 'POST', body: await file.text() },
      );
      setRestore(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup inválido.');
    } finally {
      setBusy(false);
    }
  }
  async function confirmRestore() {
    if (!restore) return;
    setBusy(true);
    setError('');
    try {
      await request(`/restores/${restore.id}/confirmations`, { method: 'POST' });
      setRestore(null);
      setMessage('Backup restaurado. As contas foram adicionadas ao seu espaço.');
      void client.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na restauração.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>Preferências</h1>
          <p>Seu espaço, suas escolhas e seus dados.</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="section-heading">
            <div>
              <h2>
                <Palette size={18} /> Aparência
              </h2>
              <p>Escolha como prefere enxergar seu espaço.</p>
            </div>
            <ThemeSwitcher />
          </div>
          <div className="settings-info">
            <strong>Claro, escuro ou automático.</strong>
            <p>
              O modo sistema acompanha a aparência do seu dispositivo. Sua escolha fica salva neste
              navegador.
            </p>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="section-heading">
            <div>
              <h2>
                <ShieldCheck size={18} /> Sua conta
              </h2>
              <p>{session?.user.email}</p>
            </div>
          </div>
          <div className="settings-info">
            <strong>Um espaço financeiro individual.</strong>
            <p>Seus dados pertencem à sua conta. Outras pessoas usam espaços separados.</p>
            <Button className="secondary" onClick={() => void authClient.auth.signOut()}>
              Sair da conta
            </Button>
          </div>
        </section>
      </div>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <h2>Categorias</h2>
            <p>Organize seus movimentos com nomes que fazem sentido para você.</p>
          </div>
          <Button className="secondary compact" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Nova categoria
          </Button>
        </div>
        <div className="category-list">
          {categories.isError ? (
            <ErrorState error={categories.error} />
          ) : categories.data?.length ? (
            categories.data.map((c) => (
              <span className="category-chip" key={c.id}>
                <span style={{ background: c.color }} />
                {c.name}
                <small>{c.type === 'income' ? 'Receita' : 'Despesa'}</small>
              </span>
            ))
          ) : (
            <p className="muted">
              Nenhuma categoria cadastrada. Crie sua primeira para organizar os movimentos.
            </p>
          )}
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <h2>Seus dados, com você</h2>
            <p>Exporte seu histórico ou restaure um backup revisado.</p>
          </div>
          <FileJson size={23} />
        </div>
        <div className="data-actions">
          <div>
            <strong>Backup financeiro · JSON</strong>
            <p>
              Contas, categorias, movimentos ativos e planejamentos mensais. Revisões de importação
              e arquivos originais não fazem parte deste backup.
            </p>
            <Button className="secondary" disabled={busy} onClick={() => void download('json')}>
              <Download size={16} />
              Baixar backup
            </Button>
          </div>
          <div>
            <strong>Movimentações · CSV</strong>
            <p>
              Uma planilha para análise. Os valores são exportados em centavos; este formato não
              restaura o aplicativo.
            </p>
            <Button className="secondary" disabled={busy} onClick={() => void download('csv')}>
              <Download size={16} />
              Exportar CSV
            </Button>
          </div>
          <div>
            <strong>Restaurar backup · JSON</strong>
            <p>
              Revise a quantidade de registros antes de confirmar. A restauração adiciona novas
              contas, sem substituir as atuais.
            </p>
            <input
              hidden
              type="file"
              accept="application/json,.json"
              ref={input}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button className="secondary" disabled={busy} onClick={() => input.current?.click()}>
              <Upload size={16} />
              Selecionar backup
            </Button>
          </div>
        </div>
      </section>
      <Modal open={open} onOpenChange={setOpen} title="Nova categoria">
        <form className="form-stack" onSubmit={category}>
          <label>
            Nome
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Alimentação"
            />
          </label>
          <label>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy}>Criar categoria</Button>
        </form>
      </Modal>
      <Modal
        open={!!restore}
        onOpenChange={(value) => !value && setRestore(null)}
        title="Revisar restauração"
        description="Os dados serão atribuídos à sua conta atual."
      >
        <div className="form-stack">
          <p>
            Este backup contém <strong>{restore?.accounts} contas</strong> e{' '}
            <strong>{restore?.transactions} movimentos</strong>. e{' '}
            <strong>{restore?.monthlyPlans ?? 0} planejamentos mensais</strong>. As contas serão
            adicionadas como novas. Planejamentos com meses já existentes bloqueiam a restauração
            para preservar seus dados. As categorias equivalentes serão reutilizadas.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy} onClick={() => void confirmRestore()}>
            {busy ? 'Restaurando…' : 'Confirmar restauração'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
