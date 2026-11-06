import { useState } from 'react';
import '../goals/goals.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { components } from '../../shared/api/generated';
import { request } from '../../shared/api/client';
import { useFinanceWrite } from '../../shared/api/use-finance-write';
import { PageHeader } from '../../shared/ui/page-header';
import { Button, Loading, ErrorState, Modal } from '../../shared/ui/primitives';
import { FinanceForm } from '../../shared/ui/finance-forms';
import { money, shortDate } from '../../shared/formatting/money';
type Queue = components['schemas']['RecognitionQueueDto'];
type Preview = components['schemas']['RecognitionPreviewDto'];
type Change = { id: string; transactionId: string; createdAt: string; undoneAt: string | null };
export function RecognitionPage() {
  const query = useQuery({
      queryKey: ['recognition'],
      queryFn: () => request<Queue>('/recognition'),
    }),
    changes = useQuery({
      queryKey: ['recognition-changes'],
      queryFn: () => request<Change[]>('/recognition/changes'),
    });
  const write = useFinanceWrite(),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState('');
  async function action(path: string, body?: unknown) {
    setError('');
    try {
      await write(path, body);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar a revisão.');
    }
  }
  return (
    <div className="page-enter">
      <PageHeader
        title="Revisão assistida"
        description="Confira identificações, categorias e possíveis pagamentos de fatura antes de aplicar."
      />
      <p className="field-help">
        Até 500 lançamentos recentes sem categoria são analisados. Escolhas manuais são preservadas.
        Cada confirmação mostra o que vai mudar; valores e datas permanecem os mesmos.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="inline-actions">
            <Button
              disabled={!selected.length}
              onClick={async () => {
                setError('');
                try {
                  setPreview(
                    await write<Preview>('/recognition/preview', { signatures: selected }),
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Não foi possível preparar a revisão.');
                }
              }}
            >
              Revisar {selected.length} escolha(s)
            </Button>
            <Button
              className="secondary"
              disabled={!selected.length}
              onClick={() => void action('/recognition/reject', { signatures: selected })}
            >
              Rejeitar sugestões
            </Button>
          </div>
          {!query.data.items.length && <p>Nenhuma sugestão pendente neste momento.</p>}
          {query.data.items.map((item) => (
            <article className="goal-record" key={item.signature}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selected.includes(item.signature)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [
                            ...selected.filter(
                              (s) =>
                                !query.data.items.some(
                                  (i) =>
                                    i.signature === s && i.transactionId === item.transactionId,
                                ),
                            ),
                            item.signature,
                          ]
                        : selected.filter((s) => s !== item.signature),
                    )
                  }
                />
                <strong>
                  {item.description} · {money(item.amount)}
                </strong>
              </label>
              <p>
                {item.accountName} · {shortDate(item.date)}
              </p>
              <p>
                {item.cardName
                  ? `Pagamento: ${item.cardName} · ${item.billMonth}`
                  : `${item.counterpartyName ?? 'Manter identificação'}${item.categoryName ? ` → ${item.categoryName}` : ''}`}
              </p>
              <p className="field-help">{item.explanation}</p>
            </article>
          ))}
        </>
      )}
      <details className="finance-disclosure">
        <summary>Alterações recentes e desfazer</summary>
        <p className="field-help">
          Pagamentos de fatura podem ser desfeitos em Cartões. Categorias e identificações só podem
          ser desfeitas aqui enquanto o lançamento não tiver sido editado novamente.
        </p>
        {changes.data?.map((c) => (
          <div key={c.id} className="goal-event">
            <Link to="/transactions">Ver lançamento</Link>
            <time>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</time>
            {c.undoneAt ? (
              <span>Desfeito</span>
            ) : (
              <button
                className="text-button"
                onClick={() => void action(`/recognition/changes/${c.id}/undo`)}
              >
                Desfazer alteração
              </button>
            )}
          </div>
        ))}
      </details>
      <Modal
        open={preview !== null}
        onOpenChange={(o) => !o && setPreview(null)}
        title="Conferir alterações"
      >
        {preview && (
          <FinanceForm
            label="Confirmar lote"
            onSubmit={async () => {
              await write(`/recognition/${preview.id}/confirm`);
              setPreview(null);
              setSelected([]);
            }}
          >
            <p>Nenhuma regra nova será aprendida automaticamente.</p>
            {preview.items.map((i) => (
              <div key={i.signature}>
                <strong>
                  {i.description} · {money(i.amount)}
                </strong>
                <p>
                  {i.cardName
                    ? `Vincular a ${i.cardName} (${i.billMonth})`
                    : `${i.counterpartyName ?? 'Identificação mantida'}${i.categoryName ? ` · categoria ${i.categoryName}` : ''}`}
                </p>
                <p className="field-help">{i.explanation}</p>
              </div>
            ))}
          </FinanceForm>
        )}
      </Modal>
    </div>
  );
}
