import { PageHeader } from '../../shared/ui/page-header';
import { BenefitPlanningNotice } from './components/benefit-planning-notice';
import { CommitmentsPage } from './commitments-page';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { validMonth } from '../../shared/formatting/month';
import { CalendarDays, Copy, Pencil, ArrowRight } from 'lucide-react';
import { dateToday, money } from '../../shared/formatting/money';
import { Button, ErrorState, Loading, Modal } from '../../shared/ui/primitives';
import { useMonthlyPlan } from './hooks/use-monthly-plan';
import { PlanningSummary } from './components/planning-summary';
import { BudgetSection } from './components/budget-section';
import { PlanForm } from './components/plan-form';
import { CopyPlanDialog } from './components/copy-plan-dialog';
import './planning.css';
export function PlanningPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'commitments' ? 'commitments' : 'budget';
  return (
    <div className="planning-workspace">
      <div className="planning-navigation">
        <ViewSwitcher
          label="Área do planejamento"
          value={view}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value === 'budget') next.delete('view');
            else next.set('view', value);
            setParams(next);
          }}
          options={[
            { value: 'budget', label: 'Orçamento mensal' },
            { value: 'commitments', label: 'Contas e previsão' },
          ]}
        />
      </div>
      {view === 'commitments' ? <CommitmentsPage /> : <MonthlyBudgetPage />}
    </div>
  );
}
function MonthlyBudgetPage() {
  const [params, setParams] = useSearchParams();
  const requestedMonth = params.get('month');
  const month = validMonth(requestedMonth) ? requestedMonth : dateToday().slice(0, 7);
  const setMonth = (value: string) => {
    if (validMonth(value)) setParams({ month: value });
  };
  const [dialog, setDialog] = useState<'edit' | 'copy' | null>(null);
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState('all');
  const { query, save, copy } = useMonthlyPlan(month, scope);
  const plan = query.data;
  function saved() {
    setDialog(null);
    setMessage('Planejamento salvo. Seus lançamentos e saldos foram preservados.');
  }
  return (
    <div className="page-enter planning-page">
      <PageHeader
        title={<>Planejamento mensal</>}
        description="Defina limites e compare com o que aconteceu."
      >
        <label className="period-picker">
          <span>Mês do plano</span>
          <input
            aria-label="Mês do planejamento"
            type="month"
            min="1900-01"
            max="9998-12"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setMessage('');
              }
            }}
          />
        </label>
        <Button
          className="compact"
          disabled={!plan || !navigator.onLine}
          onClick={() => setDialog('edit')}
        >
          <Pencil size={15} />
          {plan?.version ? 'Editar planejamento' : 'Preparar meu mês'}
        </Button>
      </PageHeader>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        plan && (
          <>
            <div className="planning-toolbar">
              <label className="planning-scope-control">
                Realizado de
                <select
                  aria-label="Contas no realizado"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="all">Todas as contas</option>
                  <option value="cash">Sem benefícios</option>
                  <option value="benefits">Só benefícios</option>
                </select>
              </label>
              <span className="planning-status">
                <CalendarDays size={16} />
                {plan.version ? 'Planejamento salvo' : 'Comece seu planejamento'}
              </span>
              <div>
                <Button
                  className="secondary compact"
                  disabled={!navigator.onLine || month === '1900-01'}
                  onClick={() => setDialog('copy')}
                >
                  <Copy size={15} />
                  Copiar mês anterior
                </Button>
              </div>
            </div>
            {message && (
              <p className="form-success" role="status">
                {message}
              </p>
            )}
            <PlanningSummary plan={plan} />
            <p className="planning-explanation">
              Previsto e realizado, lado a lado. O resultado do mês é diferente do saldo disponível.
            </p>
            {plan.totals.missingCategoryCount > 0 && (
              <div className="review-banner planning-included">
                <div>
                  <strong>Sem categoria também entra na conta</strong>
                  <p>
                    {plan.totals.missingCategoryCount} lançamentos estão em Outros e já fazem parte
                    do realizado de receitas e despesas. Categorizar depois apenas redistribui os
                    valores; o total não muda.
                  </p>
                </div>
                <Link to="/transactions">
                  Organizar categorias <ArrowRight size={16} />
                </Link>
              </div>
            )}
            {plan.totals.unclassifiedCount > 0 && (
              <div className="review-banner">
                <div>
                  <strong>Movimentos sem tipo financeiro precisam de revisão</strong>
                  <p>
                    {plan.totals.unclassifiedCount} movimentos ainda sem tipo. Entradas:{' '}
                    {money(plan.totals.unclassifiedInflow)}; saídas:{' '}
                    {money(plan.totals.unclassifiedOutflow)}. Esses movimentos ainda não entram nos
                    totais de receita/despesa.
                  </p>
                </div>
                <Link to="/transactions?type=unclassified">
                  Revisar movimentos <ArrowRight size={16} />
                </Link>
              </div>
            )}
            <div className="planning-sections">
              <BudgetSection type="income" lines={plan.lines.filter((l) => l.type === 'income')} />
              <BudgetSection
                type="expense"
                lines={plan.lines.filter((l) => l.type === 'expense')}
              />
            </div>
            <details className="planning-preferences">
              <summary>Como os valores são calculados e configurações do VA/VR</summary>
              <BenefitPlanningNotice plan={plan} scope={scope} />
              <p className="field-help">
                O filtro muda somente o realizado; o previsto é o do espaço inteiro. Transferências
                e estornos ficam fora do resultado. O saldo da conta inclui outros períodos.
                Benefícios têm uso restrito. Aporte é uma intenção; seu realizado não é identificado
                automaticamente.
              </p>
            </details>
            <section className="panel planning-note">
              <h2>Notas e próximos passos</h2>
              <p>{plan.notes || 'Registre seus compromissos e intenções ao preparar o mês.'}</p>
              <Link to="/settings/categories">
                Gerenciar categorias <ArrowRight size={14} />
              </Link>
            </section>
            <Modal
              open={dialog === 'edit'}
              onOpenChange={(open) => !open && setDialog(null)}
              title="Preparar planejamento"
              description="Defina os valores previstos para o mês selecionado."
            >
              {dialog === 'edit' && <PlanForm plan={plan} onSave={save} onSaved={saved} />}
            </Modal>
            <Modal
              open={dialog === 'copy'}
              onOpenChange={(open) => !open && setDialog(null)}
              title="Revisar cópia do mês anterior"
              description="Confira o que será substituído antes de confirmar."
            >
              {dialog === 'copy' && <CopyPlanDialog plan={plan} onCopy={copy} onCopied={saved} />}
            </Modal>
          </>
        )
      )}
    </div>
  );
}
