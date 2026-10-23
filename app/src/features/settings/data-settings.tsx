import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileJson, Upload } from 'lucide-react';
import { request, requestBlob } from '../../shared/api/client';
import { Button, Modal } from '../../shared/ui/primitives';
export function DataSettings() {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [restore, setRestore] = useState<{
    id: string;
    accounts: number;
    transactions: number;
    monthlyPlans?: number;
  } | null>(null);
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
              Contas, grupos, categorias, movimentos ativos e planejamentos mensais. Revisões de
              importação e arquivos originais não fazem parte deste backup.
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
      <Modal
        open={!!restore}
        onOpenChange={(value) => !value && setRestore(null)}
        title="Revisar restauração"
        description="Os dados serão atribuídos à sua conta atual."
      >
        <div className="form-stack">
          <p>
            Este backup contém <strong>{restore?.accounts} contas</strong> e{' '}
            <strong>{restore?.transactions} movimentos</strong> e{' '}
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
