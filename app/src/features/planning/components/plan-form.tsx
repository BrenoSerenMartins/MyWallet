import { useState, type FormEvent } from 'react';
import type { MonthlyPlan } from '../../../shared/api/resources';
import type { components } from '../../../shared/api/generated';
import { parseMoney } from '../../../shared/formatting/money';
import { Button } from '../../../shared/ui/primitives';
const inputAmount = (value: number | null) =>
  value === null ? '' : (value / 100).toFixed(2).replace('.', ',');
export function PlanForm({
  plan,
  onSave,
  onSaved,
}: {
  plan: MonthlyPlan;
  onSave: (input: components['schemas']['SaveMonthlyPlanDto']) => Promise<void>;
  onSaved: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plan.lines.filter((l) => l.categoryId).map((l) => [l.categoryId!, inputAmount(l.planned)]),
    ),
  );
  const [billAmounts, setBillAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (plan.cardPlans ?? []).map((p) => [
        `${p.accountId}:${p.billMonth}`,
        inputAmount(p.planned ?? null),
      ]),
    ),
  );
  const [cardPlans, setCardPlans] = useState(() => plan.cardPlans ?? []);
  const billPreference = (bill: NonNullable<MonthlyPlan['cardBills']>[number]) =>
    cardPlans.find((p) => p.accountId === bill.accountId && p.billMonth === bill.billMonth);
  const updateBill = (
    bill: NonNullable<MonthlyPlan['cardBills']>[number],
    change: { included?: boolean; planned?: number | null },
  ) =>
    setCardPlans((previous) => {
      const existing = previous.find(
        (p) => p.accountId === bill.accountId && p.billMonth === bill.billMonth,
      );
      return [
        ...previous.filter((p) => p.accountId !== bill.accountId || p.billMonth !== bill.billMonth),
        {
          accountId: bill.accountId,
          billMonth: bill.billMonth,
          included: existing?.included ?? bill.included,
          planned: existing?.planned ?? null,
          ...change,
        },
      ];
    });
  const [contribution, setContribution] = useState(inputAmount(plan.contribution));
  const [notes, setNotes] = useState(plan.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const lines = Object.entries(amounts)
        .filter(([, value]) => value.trim() !== '')
        .map(([categoryId, value]) => ({ categoryId, amount: parseMoney(value) }));
      await onSave({
        version: plan.version,
        cardPlans: cardPlans.map((p) => {
          const value = billAmounts[`${p.accountId}:${p.billMonth}`] ?? '';
          return { ...p, planned: value.trim() ? parseMoney(value) : null };
        }),
        notes,
        contribution: contribution.trim() ? parseMoney(contribution) : null,
        lines,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  const archivedPlans = plan.lines.filter(
    (line) => line.categoryId && line.archived && line.planned !== null && line.planned !== 0,
  );
  const categoryField = (line: MonthlyPlan['lines'][number]) => (
    <label key={line.categoryId}>
      {line.groupName ? `${line.groupName} → ${line.name}` : line.name}
      <input
        aria-label={`Previsto · ${line.name}`}
        inputMode="decimal"
        maxLength={20}
        placeholder="Não definido"
        value={amounts[line.categoryId!] ?? ''}
        onChange={(e) => setAmounts({ ...amounts, [line.categoryId!]: e.target.value })}
      />
    </label>
  );
  return (
    <form className="form-stack" onSubmit={submit}>
      <p className="field-help">
        Valores em reais. Deixe em branco o que ainda não definiu; use 0,00 para um orçamento zero.
        Salvar não cria movimentações.
      </p>
      {(['income', 'expense'] as const).map((type) => (
        <fieldset className="plan-fields" key={type}>
          <legend>{type === 'income' ? 'Receitas previstas' : 'Despesas previstas'}</legend>
          {plan.lines
            .filter((line) => line.categoryId && !line.archived && line.type === type)
            .map(categoryField)}
        </fieldset>
      ))}
      {!!plan.cardBills?.length && (
        <fieldset className="plan-fields plan-card-choices">
          <legend>Faturas que vou pagar neste mês</legend>
          <p className="field-help">
            As faturas do mês entram por padrão. Desmarcar retira apenas deste planejamento; a
            dívida continua no cartão. Deixe a previsão em branco para acompanhar o valor da fatura.
            Se você já previa esse pagamento em uma categoria comum, retire aquela previsão para não
            somar duas vezes.
          </p>
          {plan.cardBills.map((bill) => {
            const preference = billPreference(bill);
            const included = preference?.included ?? bill.included;
            return (
              <div className="plan-card-choice" key={`${bill.accountId}:${bill.billMonth}`}>
                <label className="finance-checkbox">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(e) => updateBill(bill, { included: e.target.checked })}
                  />
                  <span>
                    {bill.name} · {bill.billMonth}
                    {bill.billMonth < plan.month ? ' · fatura anterior' : ''}
                  </span>
                </label>
                {included && (
                  <label>
                    Previsão · {bill.name} · {bill.billMonth}
                    <input
                      inputMode="decimal"
                      maxLength={20}
                      placeholder={`Automático: ${inputAmount(bill.amount)}`}
                      value={billAmounts[`${bill.accountId}:${bill.billMonth}`] ?? ''}
                      onChange={(e) => {
                        setBillAmounts((previous) => ({
                          ...previous,
                          [`${bill.accountId}:${bill.billMonth}`]: e.target.value,
                        }));
                        updateBill(bill, {});
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {archivedPlans.length > 0 && (
        <details className="finance-disclosure">
          <summary>Valores anteriores em categorias arquivadas ({archivedPlans.length})</summary>
          <p className="field-help">
            Estes valores já estavam salvos neste mês e continuam nos totais. Deixe um campo em
            branco para retirar apenas sua previsão, sem alterar os lançamentos do histórico.
          </p>
          <div className="form-stack">{archivedPlans.map(categoryField)}</div>
        </details>
      )}
      <label>
        Aporte planejado (R$)
        <input
          inputMode="decimal"
          maxLength={20}
          placeholder="Opcional"
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
        />
      </label>
      <p className="field-help">
        Intenção de separar dinheiro. Não registra investimento nem altera seu patrimônio.
      </p>
      <label>
        Notas do mês
        <textarea
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        {' '}
        <Button disabled={busy || !navigator.onLine}>
          {busy ? 'Salvando…' : 'Salvar planejamento'}
        </Button>
      </div>
    </form>
  );
}
