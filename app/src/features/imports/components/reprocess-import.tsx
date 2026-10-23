import { useRef, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import type { ImportBatch } from '../../../shared/api/resources';
import { request, jsonBody } from '../../../shared/api/client';
import { Button, Modal } from '../../../shared/ui/primitives';
export function ReprocessImport({
  batch,
  onProcessed,
}: {
  batch: ImportBatch;
  onProcessed: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const [resetClassification, setResetClassification] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const allowed = batch.canReprocess ?? ['draft', 'history'].includes(batch.status);
  async function reprocess(file?: File) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (file && file.size > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.');
      const body = file
        ? new FormData()
        : jsonBody({ version: batch.version, resetClassification });
      if (body instanceof FormData && file) {
        body.append('file', file);
        body.append('version', String(batch.version));
        body.append('resetClassification', String(resetClassification));
      }
      await request(`/imports/${batch.id}/${file ? 'reprocess-file' : 'reprocess'}`, {
        method: 'POST',
        body,
      });
      await onProcessed();
      setOpen(false);
      setSuccess(
        batch.status === 'history'
          ? 'Histórico reprocessado para consulta. Nenhum lançamento foi criado.'
          : 'Importação reprocessada. Confira o resultado antes de confirmar.',
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível reprocessar.');
    } finally {
      setBusy(false);
    }
  }
  if (!allowed) return null;
  return (
    <div className="reprocess-import">
      <Button
        className="secondary compact"
        disabled={busy || !navigator.onLine}
        onClick={() => {
          setError('');
          setSuccess('');
          setResetClassification(false);
          setOpen(true);
        }}
      >
        <RefreshCw size={16} />
        Reprocessar importação
      </Button>
      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
      <Modal
        open={open}
        onOpenChange={(value) => !busy && setOpen(value)}
        title="Reprocessar importação"
        description="Atualize a análise antes de confirmar os movimentos."
      >
        <div className="form-stack">
          <p>
            As duplicatas e a conciliação serão verificadas de novo. Suas seleções serão mantidas, e
            duplicatas identificadas continuam bloqueadas.
          </p>
          <label className="reprocess-choice">
            <input
              type="checkbox"
              checked={resetClassification}
              disabled={busy}
              onChange={(event) => setResetClassification(event.target.checked)}
            />
            <span>Refazer também os tipos financeiros</span>
          </label>
          <p className="field-help">
            Desmarcado: preserva os tipos já definidos. Marcado: usa as regras atuais em todos os
            movimentos e mantém as categorias compatíveis. Cofrinhos reconhecidos continuam como
            transferências.
          </p>
          <div className="reprocess-option">
            <strong>Usar os dados já salvos</strong>
            <p className="field-help">
              Reanalisa os movimentos extraídos e renova a revisão. Não precisa enviar o arquivo
              novamente.
            </p>
            <Button disabled={busy || !navigator.onLine} onClick={() => void reprocess()}>
              <RefreshCw size={16} />
              {busy ? 'Reprocessando…' : 'Reprocessar dados salvos'}
            </Button>
          </div>
          <div className="reprocess-option">
            <strong>Reler o arquivo original</strong>
            <p className="field-help">
              Para atualizar a leitura do PDF, CSV ou XLSX. Selecione o mesmo arquivo desta
              importação; o original não fica armazenado no app.
            </p>
            <input
              ref={input}
              hidden
              type="file"
              accept="application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.csv,.xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void reprocess(file);
              }}
            />
            <Button
              className="secondary"
              disabled={busy || !navigator.onLine}
              onClick={() => input.current?.click()}
            >
              <Upload size={16} />
              Selecionar arquivo original
            </Button>
          </div>
          <p className="field-help">
            Esta ação atualiza a revisão ou o histórico de consulta. Nenhum lançamento será
            confirmado automaticamente.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
