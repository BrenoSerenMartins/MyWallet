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
            .filter((l) => l.categoryId && l.type === type)
            .map((line) => (
              <label key={line.categoryId}>
                {line.name}
                {line.archived ? ' (arquivada)' : ''}
                <input
                  aria-label={`Previsto · ${line.name}`}
                  inputMode="decimal"
                  maxLength={20}
                  placeholder="Não definido"
                  value={amounts[line.categoryId!] ?? ''}
                  onChange={(e) => setAmounts({ ...amounts, [line.categoryId!]: e.target.value })}
                />
              </label>
            ))}
        </fieldset>
      ))}
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
      <Button disabled={busy || !navigator.onLine}>
        {busy ? 'Salvando…' : 'Salvar planejamento'}
      </Button>
    </form>
  );
}
