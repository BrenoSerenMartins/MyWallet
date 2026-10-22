import { CheckCircle2 } from 'lucide-react';
import { ImportReview } from './components/import-review';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ChevronRight, FileText, Upload } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { request } from '../../shared/api/client';
import type { Account, ImportBatch } from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading } from '../../shared/ui/primitives';
export function ImportsPage() {
  const { importId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accounts = useQuery({
    queryKey: [session?.user.id, 'accounts'],
    queryFn: () => request<Account[]>('/accounts'),
  });
  const history = useQuery({
    queryKey: [session?.user.id, 'imports'],
    queryFn: () =>
      request<{ id: string; fileName: string; status: string; createdAt: string }[]>('/imports'),
  });
  const batch = useQuery({
    queryKey: [session?.user.id, 'import', importId],
    queryFn: () => request<ImportBatch>(`/imports/${importId}`),
    enabled: !!importId,
  });
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo deve ter até 10 MB.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set('accountId', account);
      form.set('file', file);
      const result = await request<ImportBatch>('/imports', { method: 'POST', body: form });
      void client.invalidateQueries();
      navigate('/imports/' + result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível importar.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MENOS DIGITAÇÃO, MAIS CLAREZA</span>
          <h1>{importId ? 'Revise seu extrato' : 'Importar extrato'}</h1>
          <p>
            {importId
              ? 'Confira cada movimento antes de adicionar à sua conta.'
              : 'Traga seus movimentos para cá. Você confere tudo antes de salvar.'}
          </p>
        </div>
        {importId && (
          <Link className="button secondary" to="/imports">
            <ArrowLeft size={16} />
            Importações
          </Link>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {importId ? (
        batch.isPending ? (
          <Loading />
        ) : batch.isError ? (
          <ErrorState error={batch.error} />
        ) : (
          <ImportReview
            key={batch.data.id}
            batch={batch.data}
            refresh={() => client.invalidateQueries()}
          />
        )
      ) : (
        <>
          <div className="import-grid">
            <section className="panel upload-panel">
              <span className="file-icon">
                <FileText size={28} />
              </span>
              <h2>
                Seu Mercado Pago,
                <br />
                sem começar do zero.
              </h2>
              <p>
                Envie o PDF do extrato de conta. Vamos organizar os dados e conferir os saldos para
                você revisar.
              </p>
              {accounts.isPending ? (
                <Loading />
              ) : accounts.isError ? (
                <ErrorState error={accounts.error} />
              ) : accounts.data.some((a) => a.institution === 'mercado_pago') ? (
                <>
                  <label>
                    Conta de destino
                    <select value={account} onChange={(e) => setAccount(e.target.value)}>
                      <option value="">Selecione sua conta Mercado Pago</option>
                      {accounts.data
                        .filter((a) => a.institution === 'mercado_pago')
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <input
                    ref={input}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => void upload(e)}
                  />
                  <Button
                    disabled={!account || busy || !navigator.onLine}
                    onClick={() => input.current?.click()}
                  >
                    <Upload size={18} />
                    {busy ? 'Lendo e conferindo o extrato…' : 'Selecionar PDF'}
                  </Button>
                  <span className="field-help">PDF com texto · até 10 MB e 100 páginas</span>
                </>
              ) : (
                <EmptyState
                  title="Primeiro, adicione sua conta"
                  action={
                    <Link className="button" to="/accounts">
                      Adicionar conta <ArrowRight size={16} />
                    </Link>
                  }
                >
                  Cadastre o Mercado Pago com o saldo e a data inicial do seu extrato.
                </EmptyState>
              )}
            </section>
            <aside className="panel import-guide">
              <span className="eyebrow">VOCÊ NO CONTROLE</span>
              <h2>Do arquivo à sua visão financeira.</h2>
              {[
                {
                  n: '01',
                  title: 'Envie seu extrato',
                  text: 'Escolha o PDF e a conta à qual ele pertence.',
                },
                {
                  n: '02',
                  title: 'Confira os movimentos',
                  text: 'Revise receitas, despesas e transferências. Possíveis duplicidades ficam sinalizadas.',
                },
                {
                  n: '03',
                  title: 'Confirme quando estiver pronto',
                  text: 'Os lançamentos só entram no seu saldo depois da sua confirmação.',
                },
              ].map((step) => (
                <div className="guide-step" key={step.n}>
                  <span>{step.n}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
              <div className="guide-note">
                <CheckCircle2 size={18} />
                <p>
                  O arquivo original não fica armazenado. Mantemos os movimentos que você confirmar
                  e a referência da importação.
                </p>
              </div>
            </aside>
          </div>
          <section className="panel history-panel">
            <div className="section-heading">
              <div>
                <h2>Suas importações</h2>
                <p>Revise o histórico e acompanhe cada arquivo.</p>
              </div>
            </div>
            {history.isPending ? (
              <Loading />
            ) : history.isError ? (
              <ErrorState error={history.error} />
            ) : history.data.length ? (
              history.data.map((item) => (
                <Link className="import-history-row" to={'/imports/' + item.id} key={item.id}>
                  <FileText size={20} />
                  <div>
                    <strong>{item.fileName}</strong>
                    <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <span className={`badge ${item.status === 'confirmed' ? 'success' : ''}`}>
                    {item.status === 'confirmed'
                      ? 'Confirmado'
                      : item.status === 'reversed'
                        ? 'Desfeito'
                        : 'Em revisão'}
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ))
            ) : (
              <EmptyState title="Seu histórico começa no primeiro arquivo">
                Cada importação fica registrada para você conferir depois.
              </EmptyState>
            )}
          </section>
        </>
      )}
    </div>
  );
}
