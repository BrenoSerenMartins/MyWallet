import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Clock3, FileText, LoaderCircle } from 'lucide-react';
import type { StatementUpload } from '../hooks/use-statement-uploads';
import { Button } from '../../../shared/ui/primitives';
function statusText(row: StatementUpload) {
  if (row.status === 'reading') return 'Lendo e conferindo…';
  if (row.status === 'queued') return 'Na fila';
  if (row.status === 'skipped') return 'Não enviado';
  if (row.status === 'error') return row.error;
  if (row.repeated) return 'Mesmo extrato de outro arquivo deste lote';
  if (row.result?.status === 'confirmed') return 'Extrato já confirmado';
  if (row.result?.status === 'history') return 'Já salvo para consulta';
  return 'Pronto para revisar';
}
export function UploadResults({
  rows,
  busy,
  stopping,
  onStop,
}: {
  rows: StatementUpload[];
  busy: boolean;
  stopping: boolean;
  onStop: () => void;
}) {
  if (!rows.length) return null;
  const processed = rows.filter((row) => ['ready', 'error'].includes(row.status)).length;
  return (
    <section className="panel upload-results" aria-label="Resultado do envio de extratos">
      <div className="section-heading">
        <div>
          <h2>{busy ? 'Processando seus arquivos' : 'Resultado do envio'}</h2>
          <p role="status">
            {processed} de {rows.length} arquivos processados ·{' '}
            {rows.filter((row) => row.status === 'error').length} com erro ·{' '}
            {rows.filter((row) => row.status === 'skipped').length} não enviados
          </p>
        </div>
        {busy && (
          <Button className="secondary compact" onClick={onStop} disabled={stopping}>
            {stopping ? 'Parando após este arquivo…' : 'Parar após este arquivo'}
          </Button>
        )}
      </div>
      <progress aria-label="Progresso do envio" max={rows.length} value={processed} />
      <p className="upload-queue-help">
        Mantenha esta tela aberta para terminar a fila. Sair interrompe os próximos envios; o
        arquivo em andamento pode terminar e os já processados continuam no histórico. Cada extrato
        exige sua revisão antes de entrar nos saldos.
      </p>
      <ul>
        {rows.map((row, index) => {
          const Icon =
            row.status === 'reading'
              ? LoaderCircle
              : row.status === 'error'
                ? CircleAlert
                : row.status === 'ready'
                  ? CheckCircle2
                  : row.status === 'queued'
                    ? Clock3
                    : FileText;
          return (
            <li key={index} className={row.status === 'error' ? 'upload-file-error' : ''}>
              <Icon size={19} aria-hidden="true" />
              <div>
                <strong>{row.name}</strong>
                <span>{statusText(row)}</span>
              </div>
              {row.result && !busy && (
                <Link className="text-button" to={`/imports/${row.result.id}`}>
                  {row.result.status === 'draft' ? 'Revisar' : 'Abrir extrato'}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {!busy && rows.some((row) => row.status === 'error' || row.status === 'skipped') && (
        <p className="upload-queue-help">
          Para tentar de novo, selecione os arquivos com erro ou não enviados. Arquivos iguais
          retornam ao extrato existente; possíveis movimentos duplicados entre formatos continuam
          sujeitos à revisão.
        </p>
      )}
    </section>
  );
}
