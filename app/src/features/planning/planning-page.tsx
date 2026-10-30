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
      <ViewSwitcher
        label="Contas no realizado"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'all', label: 'Todas as contas' },
          { value: 'cash', label: 'Sem benefícios' },
          { value: 'benefits', label: 'Só benefícios' },
        ]}
      />
      <p className="field-help">
        O filtro altera apenas o realizado. O planejamento salvo continua sendo o do espaço inteiro.
      </p>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU MÊS, COM DIREÇÃO</span>
          <h1>Planejamento mensal</h1>
          <p>Planeje com intenção. Acompanhe o que acontece de verdade.</p>
        </div>
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
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        plan && (
          <>
            <div className="planning-toolbar">
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
                <Button
                  className="compact"
                  disabled={!navigator.onLine}
                  onClick={() => setDialog('edit')}
                >
                  <Pencil size={15} />
                  {plan.version ? 'Editar planejamento' : 'Preparar meu mês'}
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
              Comparação dos valores salvos com receitas e despesas registradas no mês. O resultado
              não é o saldo da conta. Transferências e estornos ficam fora destes totais.
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
            <section className="panel planning-note">
              <h2>Notas e próximos passos</h2>
              <p>{plan.notes || 'Registre seus compromissos e intenções ao preparar o mês.'}</p>
              <Link to="/settings/categories">
                Gerenciar categorias <ArrowRight size={14} />
              </Link>
              <p className="field-help">
                Os valores refletem apenas as contas e os lançamentos cadastrados. Benefícios de uso
                restrito não devem ser tratados como dinheiro livre. O aporte é uma intenção; seu
                realizado ainda não é identificado automaticamente.
              </p>
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
