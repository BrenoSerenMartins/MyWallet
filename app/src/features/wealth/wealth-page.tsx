import { IconAction } from '../../shared/ui/icon-action';
import { ChartNoAxesCombined as EmptyStateIcon } from 'lucide-react';
import { HelpTip, Tooltip } from '../../shared/ui/tooltip';
import { useNotifications } from '../../shared/feedback/notification-provider';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, EyeOff, ArrowUpRight, Camera, Pencil } from 'lucide-react';
import { request } from '../../shared/api/client';
import { useFinanceWrite } from '../../shared/api/use-finance-write';
import type { WealthSummary, InvestmentHolding } from '../../shared/api/resources';
import { Button, EmptyState, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { FinanceForm } from '../../shared/ui/finance-forms';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { money, shortDate } from '../../shared/formatting/money';
import {
  HoldingForm,
  InvestmentOperationForm,
  WealthItemForm,
  productNames,
} from './components/wealth-forms';
import { WealthHistory } from './components/wealth-history';
import '../cards/cards.css';
import './wealth.css';
type Dialog =
  | { kind: 'newHolding' }
  | {
      kind: 'holding' | 'editHolding' | 'operation' | 'undo';
      id: string;
      operation?: 'contribution' | 'redemption' | 'income' | 'valuation' | 'capital';
    }
  | { kind: 'item'; id?: string };
export function WealthPage() {
  const [params, setParams] = useSearchParams();
  const view = ['investments', 'items', 'history'].includes(params.get('view') ?? '')
    ? params.get('view')!
    : 'investments';
  const query = useQuery({
    queryKey: ['wealth'],
    queryFn: () => request<WealthSummary>('/wealth'),
  });
  const write = useFinanceWrite();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [visible, setVisible] = useState(true);
  const [archived, setArchived] = useState(false);
  const { success: setMessage } = useNotifications();
  const [captureBusy, setCaptureBusy] = useState(false);
  const captureNotices = useNotifications();
  const setError = (message: string) => {
    if (message) captureNotices.error(message, { id: 'wealth-capture' });
    else captureNotices.dismiss('wealth-capture');
  };
  const [search, setSearch] = useState('');
  const data = query.data;
  const selected =
    dialog && 'id' in dialog ? data?.holdings.find((h) => h.id === dialog.id) : undefined;
  const item =
    dialog?.kind === 'item' && dialog.id ? data?.items.find((i) => i.id === dialog.id) : undefined;
  const value = (n: number) => (visible ? money(n) : '••••••');
  const saved = () => {
    setDialog(null);
    setMessage('Posição atualizada. O patrimônio e os relatórios foram recalculados.');
  };
  const holdings =
    data?.holdings.filter(
      (h) =>
        (archived || !h.archived) &&
        `${h.name} ${h.provider}`
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR')),
    ) ?? [];
  async function capture() {
    setCaptureBusy(true);
    setError('');
    try {
      await write('/wealth/snapshots');
      setMessage('Posição patrimonial salva na evolução.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setCaptureBusy(false);
    }
  }
  return (
    <div className="page-enter wealth-page">
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        data && (
          <>
            <section className="wealth-summary">
              <div className="wealth-summary-toolbar">
                <h1 className="contextual-page-title" aria-label="Investimentos e patrimônio">
                  Patrimônio
                </h1>
                <div className="inline-actions">
                  <Tooltip
                    text={
                      visible ? 'Ocultar valores do patrimônio' : 'Mostrar valores do patrimônio'
                    }
                  >
                    <button
                      className="icon-button"
                      aria-label={
                        visible ? 'Ocultar valores do patrimônio' : 'Mostrar valores do patrimônio'
                      }
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </Tooltip>
                  {view === 'history' ? (
                    <IconAction
                      label={captureBusy ? 'Salvando posição…' : 'Guardar posição atual'}
                      icon={<Camera size={17} />}
                      className="secondary compact"
                      disabled={captureBusy || !data || !navigator.onLine}
                      onClick={() => void capture()}
                    />
                  ) : (
                    <IconAction
                      label={view === 'investments' ? 'Novo investimento' : 'Adicionar posição'}
                      icon={<Plus size={18} />}
                      disabled={!navigator.onLine}
                      onClick={() =>
                        setDialog(
                          view === 'investments' ? { kind: 'newHolding' } : { kind: 'item' },
                        )
                      }
                    />
                  )}
                </div>
              </div>
              <div className="wealth-overview">
                <div className="panel wealth-net-worth">
                  <span>
                    Patrimônio registrado
                    <HelpTip
                      label="Cálculo do patrimônio"
                      text="Contas, reservas, investimentos avaliados e bens, menos dívidas e saldos negativos. Benefícios ficam de fora. As posições e avaliações são as informadas por você."
                    />
                  </span>
                  <strong className={data.netWorth < 0 ? 'negative' : ''}>
                    {value(data.netWorth)}
                  </strong>
                  <small>Ativos menos dívidas · pelas posições cadastradas</small>
                </div>
                <div className="panel">
                  <span>Ativos registrados</span>
                  <strong>{value(data.assets)}</strong>
                  <small>Contas, reservas, investimentos e bens</small>
                </div>
                <div className="panel">
                  <span>Dívidas registradas</span>
                  <strong>{value(data.liabilities)}</strong>
                  <small>Cartões, contas negativas e outras dívidas</small>
                </div>
              </div>

              <div className="summary-navigation">
                <ViewSwitcher
                  variant="tabs"
                  label="Área do patrimônio"
                  value={view}
                  onChange={(v) => {
                    const next = new URLSearchParams(params);
                    next.set('view', v);
                    setParams(next);
                  }}
                  options={[
                    { value: 'investments', label: 'Investimentos' },
                    { value: 'items', label: 'Bens e dívidas' },
                    { value: 'history', label: 'Evolução' },
                  ]}
                />
              </div>
            </section>
            {view === 'investments' ? (
              <>
                <div className="section-heading">
                  <h2>Carteira de investimentos</h2>
                </div>
                <div className="wealth-filters">
                  <label>
                    <span className="sr-only">Buscar investimento</span>
                    <input
                      type="search"
                      placeholder="Buscar investimento ou custódia…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label className="finance-checkbox">
                    <input
                      type="checkbox"
                      checked={archived}
                      onChange={(e) => setArchived(e.target.checked)}
                    />
                    Mostrar arquivados
                  </label>
                </div>
                {!holdings.length ? (
                  <EmptyState
                    icon={<EmptyStateIcon size={28} strokeWidth={1.5} />}
                    title={
                      data.holdings.length
                        ? 'Nenhuma posição neste filtro'
                        : 'Sua carteira, em um lugar'
                    }
                  >
                    {data.holdings.length
                      ? 'Experimente outro nome ou inclua as posições arquivadas.'
                      : 'Use Novo investimento para cadastrar uma posição existente ou começar a registrar seus aportes.'}
                  </EmptyState>
                ) : (
                  <ul className="investment-list">
                    {holdings.map((h) => (
                      <li className="panel investment-row" key={h.id}>
                        <div className="investment-name">
                          <strong>{h.name}</strong>
                          <span>
                            {productNames[h.productType]}
                            {h.provider ? ` · ${h.provider}` : ''}
                            {h.archived ? ' · Arquivado' : ''}
                          </span>
                          <small>
                            {h.valuationMethod === 'flow_estimate'
                              ? 'Estimativa após movimento'
                              : 'Avaliação informada'}{' '}
                            · {shortDate(h.valuationDate)} {h.valuationDate.slice(0, 4)}
                            {h.stale ? ' · Atualização sugerida' : ''}
                          </small>
                        </div>
                        <div className="investment-value">
                          <span>Valor da posição</span>
                          <strong>{value(h.marketValue)}</strong>
                          <small>Capital {value(h.capital)}</small>
                        </div>
                        <div className="investment-result">
                          <span>Resultado total registrado</span>
                          <strong className={h.totalResult < 0 ? 'negative' : 'positive'}>
                            {value(h.totalResult)}
                          </strong>
                          <small>Realizado + não realizado</small>
                        </div>
                        <div className="investment-actions">
                          <button
                            className="text-button"
                            onClick={() => setDialog({ kind: 'holding', id: h.id })}
                          >
                            Ver detalhes <ArrowUpRight size={15} />
                          </button>
                          <Button
                            className="secondary compact"
                            disabled={h.archived || !navigator.onLine}
                            onClick={() =>
                              setDialog({ kind: 'operation', id: h.id, operation: 'valuation' })
                            }
                          >
                            Atualizar valor
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="field-help">
                  Valores em reais, informados manualmente. O resultado diferencia capital de ganhos
                  e perdas; não representa retorno percentual ajustado pelo tempo nem cálculo de
                  impostos.
                </p>
              </>
            ) : view === 'items' ? (
              <>
                <div className="section-heading">
                  <h2>Bens e outras dívidas</h2>
                </div>
                {!data.items.length ? (
                  <EmptyState
                    icon={<EmptyStateIcon size={28} strokeWidth={1.5} />}
                    title="Complete sua visão patrimonial"
                  >
                    Cadastre bens e saldos de dívidas que ainda não estão representados nas contas,
                    investimentos e cartões.
                  </EmptyState>
                ) : (
                  <ul className="wealth-item-list">
                    {data.items.map((i) => (
                      <li className={`panel ${i.archived ? 'inactive' : ''}`} key={i.id}>
                        <div>
                          <strong>{i.name}</strong>
                          <span>
                            {i.kind === 'asset' ? 'Bem ou ativo' : 'Dívida'} ·{' '}
                            {shortDate(i.valuationDate)} {i.valuationDate.slice(0, 4)}
                            {i.archived ? ' · Arquivado' : ''}
                          </span>
                          {i.notes && <small>{i.notes}</small>}
                        </div>
                        <strong className={i.kind === 'debt' ? 'negative' : ''}>
                          {value(i.value)}
                        </strong>
                        <Tooltip text={`Editar posição ${i.name}`}>
                          <button
                            className="icon-button"
                            aria-label={`Editar posição ${i.name}`}
                            onClick={() => setDialog({ kind: 'item', id: i.id })}
                          >
                            <Pencil size={18} />
                          </button>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <WealthHistory history={data.history} visible={visible} />
            )}
            <details className="panel wealth-composition finance-disclosure">
              <summary>Composição do patrimônio</summary>
              <dl>
                {[
                  ['Dinheiro nas contas', data.cash],
                  ['Reservas', data.reserves],
                  ['Investimentos avaliados', data.investments],
                  ['Outros bens e ativos', data.otherAssets],
                  ['Créditos nos cartões', data.cardCredit],
                  ['Dívidas de cartões', -data.cardDebt],
                  ['Contas com saldo negativo', -data.overdrafts],
                  ['Outras dívidas', -data.otherDebts],
                ].map(([label, amount]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>{value(Number(amount))}</dd>
                  </div>
                ))}
              </dl>
              <p className="field-help">
                Benefícios de uso restrito ({value(data.benefitsExcluded)}) ficam fora do
                patrimônio. O capital contábil dos investimentos não é somado novamente ao valor
                avaliado. <Link to="/cards">Revisar cartões</Link>.
              </p>
            </details>
          </>
        )
      )}
      <Modal
        open={!!dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        variant={dialog?.kind === 'holding' ? 'detail' : 'dialog'}
        title={
          dialog?.kind === 'newHolding'
            ? 'Novo investimento'
            : dialog?.kind === 'editHolding'
              ? 'Editar investimento'
              : dialog?.kind === 'operation'
                ? 'Movimentar investimento'
                : dialog?.kind === 'item'
                  ? 'Bem ou dívida'
                  : dialog?.kind === 'undo'
                    ? 'Desfazer último registro'
                    : (selected?.name ?? 'Investimento')
        }
        description="Confira os dados e a data de referência antes de salvar."
      >
        {dialog?.kind === 'newHolding' && <HoldingForm write={write} onSaved={saved} />}
        {dialog?.kind === 'editHolding' && selected && (
          <HoldingForm holding={selected} write={write} onSaved={saved} />
        )}
        {dialog?.kind === 'operation' && selected && (
          <InvestmentOperationForm
            holding={selected}
            initial={dialog.operation}
            write={write}
            onSaved={saved}
          />
        )}
        {dialog?.kind === 'item' && <WealthItemForm item={item} write={write} onSaved={saved} />}
        {dialog?.kind === 'holding' && selected && (
          <HoldingDetail
            holding={selected}
            visible={visible}
            onEdit={() => setDialog({ kind: 'editHolding', id: selected.id })}
            onMove={(kind) => setDialog({ kind: 'operation', id: selected.id, operation: kind })}
            onUndo={() => setDialog({ kind: 'undo', id: selected.id })}
          />
        )}
        {dialog?.kind === 'undo' && selected && (
          <FinanceForm
            label="Confirmar desfazimento"
            onSubmit={async () => {
              const result = await write<{ preservedBankMovement: boolean }>(
                `/wealth/holdings/${selected.id}/reversal`,
                undefined,
                selected.version,
              );
              setDialog(null);
              setMessage(
                result.preservedBankMovement
                  ? 'Vínculo desfeito. O movimento bancário foi preservado; confira e vincule à posição correta.'
                  : 'Último registro desfeito. A posição e os movimentos criados foram corrigidos.',
              );
            }}
          >
            <p>
              Desfaz o último registro ativo de <strong>{selected.name}</strong> e restaura a
              posição anterior, mantendo o histórico da correção.
            </p>
            <p className="field-help">
              Movimentos criados pelo módulo serão desfeitos. Se o registro foi vinculado a um
              extrato, o movimento bancário será preservado sem vínculo; confira a associação
              correta em seguida.
            </p>
          </FinanceForm>
        )}
      </Modal>
    </div>
  );
}
const eventNames = {
  contribution: 'Aporte',
  redemption: 'Resgate',
  income: 'Rendimento recebido',
  valuation: 'Avaliação',
  capital: 'Correção de capital',
  edit: 'Dados da posição',
  undo: 'Desfazimento',
};
function HoldingDetail({
  holding,
  visible,
  onEdit,
  onMove,
  onUndo,
}: {
  holding: InvestmentHolding;
  visible: boolean;
  onEdit: () => void;
  onMove: (kind: 'contribution' | 'redemption' | 'income' | 'valuation' | 'capital') => void;
  onUndo: () => void;
}) {
  const value = (n: number) => (visible ? money(n) : '••••••');
  return (
    <div className="holding-detail">
      <p>
        {productNames[holding.productType]} · {holding.provider || 'Custódia não informada'}
      </p>
      <dl className="holding-values">
        {[
          ['Capital registrado', holding.capital],
          ['Valor da posição', holding.marketValue],
          ['Resultado realizado', holding.realized],
          ['Resultado não realizado', holding.unrealized],
        ].map(([label, amount]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{value(Number(amount))}</dd>
          </div>
        ))}
      </dl>
      <p className="field-help">
        {holding.valuationMethod === 'flow_estimate'
          ? 'Valor estimado após movimentação'
          : 'Avaliação manual'}{' '}
        em {shortDate(holding.valuationDate)} {holding.valuationDate.slice(0, 4)}. Valorização não
        realizada não entra nas receitas do mês.
      </p>
      <div className="holding-actions">
        {(['contribution', 'redemption', 'income', 'valuation'] as const).map((kind) => (
          <Button
            className="secondary compact"
            key={kind}
            disabled={holding.archived || !navigator.onLine}
            onClick={() => onMove(kind)}
          >
            {eventNames[kind]}
          </Button>
        ))}
      </div>
      <details className="finance-disclosure">
        <summary>Dados e correções</summary>
        <div className="holding-actions">
          <button className="text-button" onClick={onEdit}>
            Editar dados
          </button>
          <button
            className="text-button"
            onClick={() => onMove('capital')}
            disabled={holding.archived}
          >
            Corrigir capital informado
          </button>
          {holding.lastEventId && (
            <button className="text-button" onClick={onUndo}>
              Desfazer último registro
            </button>
          )}
        </div>
      </details>
      <h3>Histórico da posição</h3>
      {!holding.events.length ? (
        <p>Posição inicial cadastrada, sem movimentações posteriores.</p>
      ) : (
        <ul className="holding-event-list">
          {holding.events.map((e) => (
            <li key={e.id}>
              <div>
                <strong>
                  {eventNames[e.kind]}
                  {e.undone ? ' · Desfeito' : ''}
                </strong>
                <span>
                  {shortDate(e.eventDate)} {e.eventDate.slice(0, 4)}
                </span>
                {e.effectiveAmount !== undefined && e.effectiveAmount !== e.amount && (
                  <small>Líquido após devoluções {value(e.effectiveAmount)}</small>
                )}
                {typeof e.details.reason === 'string' && e.details.reason && (
                  <small>{e.details.reason}</small>
                )}
              </div>
              {e.amount > 0 && <strong>{value(e.amount)}</strong>}
              {(e.linkedId || e.resultId || e.debitId) && !e.undone && (
                <Link
                  className="text-button"
                  to={`/transactions?transaction=${e.linkedId ?? e.resultId ?? e.debitId}`}
                >
                  Ver movimento
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
