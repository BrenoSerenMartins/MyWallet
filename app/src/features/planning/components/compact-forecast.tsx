import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import type { CommitmentsSummary } from '../../../shared/api/resources';
import { money, shortDate } from '../../../shared/formatting/money';
import { Modal } from '../../../shared/ui/primitives';
import { HelpTip } from '../../../shared/ui/tooltip';
import { forecastPreview } from '../forecast-preview';

export function CompactForecast({
  data,
  visible,
  onAdd,
}: {
  data: CommitmentsSummary;
  visible: boolean;
  onAdd: () => void;
}) {
  const preview = forecastPreview(data);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = preview.items.find((item) => item.id === selected);
  const display = (amount: number) => (visible ? money(amount) : '••••••');
  const destination = `/planning?view=commitments&month=${data.month}`;
  return (
    <>
      <header className="forecast-preview-heading">
        <h2>O que vem pela frente</h2>
        {preview.hasPending && (
          <Link className="text-button" to={destination}>
            Ver todos <ArrowRight size={15} />
          </Link>
        )}
      </header>
      {preview.hasPending ? (
        <>
          <div className="forecast-preview-totals">
            <div className="forecast-preview-result">
              <span>
                Saldo previsto{' '}
                <HelpTip
                  label="Como calculamos o saldo previsto"
                  text="Saldo atual das contas de dinheiro, mais recebimentos e menos pagamentos pendentes até a data indicada. Inclui faturas e vencimentos anteriores em aberto; benefícios e reservas ficam separados."
                />
              </span>
              <strong className={preview.projected < 0 ? 'negative-text' : ''}>
                {display(preview.projected)}
              </strong>
              <small>Até {shortDate(data.through)} · contas de dinheiro</small>
            </div>
            <dl>
              <div>
                <dt>A receber</dt>
                <dd>{display(preview.income)}</dd>
              </div>
              <div>
                <dt>A pagar</dt>
                <dd>{display(preview.expense)}</dd>
              </div>
            </dl>
          </div>
          <ul className="forecast-preview-list" aria-label="Próximos vencimentos">
            {preview.items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setSelected(item.id)}>
                  <span className="forecast-preview-date">
                    {shortDate(item.dueDate)}
                    <small>
                      {item.dueDate < data.today
                        ? 'Em atraso'
                        : item.type === 'income'
                          ? 'A receber'
                          : 'A pagar'}
                    </small>
                  </span>
                  <span className="forecast-preview-description">
                    {item.description}
                    <small>{item.account}</small>
                  </span>
                  <strong className={item.type === 'income' ? 'positive-text' : ''}>
                    {display(item.amount)}
                  </strong>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="forecast-preview-empty">
          <p>Nenhum compromisso previsto</p>
          <button type="button" className="text-button" onClick={onAdd}>
            <Plus size={16} />
            Adicionar compromisso
          </button>
        </div>
      )}
      <Modal
        open={!!detail}
        onOpenChange={(open) => !open && setSelected(null)}
        title={detail?.description ?? 'Vencimento'}
        description="Detalhes do compromisso previsto."
      >
        {detail && (
          <div className="forecast-preview-detail">
            <strong>{display(detail.amount)}</strong>
            <p>
              {detail.type === 'income' ? 'A receber' : 'A pagar'} · {shortDate(detail.dueDate)}
            </p>
            <p>{detail.account}</p>
            {detail.dueDate < data.today && <p className="negative-text">Vencimento em atraso</p>}
            <Link className="button secondary" to={detail.href ?? destination}>
              {detail.href ? 'Ver fatura' : 'Gerenciar compromisso'}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}
