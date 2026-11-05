import type { components } from '../api/generated';
import { money } from '../formatting/money';
import { Link } from 'react-router-dom';
import './period-budget.css';
type Budget = components['schemas']['PeriodBudgetDto'];
export function PeriodBudget({
  budget,
  visible = true,
  forecast,
}: {
  budget?: Budget;
  visible?: boolean;
  forecast?: { result: number | null; contribution: number | null };
}) {
  if (!budget) return null;
  const display = (value: number | null) =>
    !visible ? '••••••' : value == null ? 'Histórico incompleto' : money(value);
  const reasons: Record<string, string> = {
    'missing-reference': 'Falta uma referência de saldo para este período.',
    'reference-after-cut': 'A referência disponível é posterior ao início deste período.',
    'reference-under-review': 'A referência de saldo precisa de conferência.',
  };
  return (
    <section className="period-budget" aria-label="Disponível no período">
      <div className="period-budget-head">
        <div>
          <span>Saldo trazido</span>
          <strong>{display(budget.carried)}</strong>
        </div>
        <div>
          <span>Disponível no fim do período</span>
          <strong>{display(budget.available)}</strong>
        </div>
      </div>
      {forecast && (
        <p className="field-help">
          Disponível previsto após a meta de poupança:{' '}
          <strong>
            {!visible
              ? '••••••'
              : budget.carried == null
                ? 'Histórico incompleto'
                : forecast.result == null
                  ? 'Previsão não definida'
                  : money(budget.carried + forecast.result - (forecast.contribution ?? 0))}
          </strong>
          . Essa previsão usa receitas e despesas planejadas; não desconta os aportes realizados
          outra vez.
        </p>
      )}
      <p className="field-help">
        Inclui contas de dinheiro e benefícios; reservas e investimentos ficam fora. Saldo trazido
        não é receita nova. Créditos destinados a meses futuros ainda não estão disponíveis neste
        período.
      </p>
      {budget.coverage !== 'complete' && (
        <p role="status">
          Saldo trazido incompleto. Confira as referências das contas nos detalhes. Receitas e
          despesas conhecidas continuam no resultado do mês.
        </p>
      )}
      <details>
        <summary>Composição do disponível</summary>
        <p className="field-help">
          O disponível acompanha as contas, enquanto o resultado do mês mede receitas menos
          despesas. Pagamento de fatura e aportes são saídas de recursos, sem contar a compra ou a
          poupança como despesa outra vez.
        </p>
        <dl className="period-budget-flows">
          {[
            ['Saldo trazido', budget.carried],
            ['Entradas nas contas', budget.income],
            ['Despesas nas contas', -budget.expense],
            ['Transferências líquidas', budget.transfers],
            ['A revisar (líquido)', budget.unclassified],
            ['Ajustes de posição', budget.adjustments],
            ['Disponível final', budget.available],
          ].map(([label, amount]) => (
            <div key={label as string}>
              <dt>{label}</dt>
              <dd>{display(amount as number | null)}</dd>
            </div>
          ))}
          <div>
            <dt>Guardado líquido em reservas/investimentos (incluído nas transferências)</dt>
            <dd>{display(budget.reserved)}</dd>
          </div>
        </dl>
        <p className="field-help">
          A meta de poupar é uma intenção; o guardado realizado vem das transferências. Se houve
          consumo antecipado do benefício, o saldo trazido ajustado pode ser negativo.
        </p>
        {budget.accounts.map((account) => (
          <details key={account.accountId} className="period-budget-account">
            <summary>{account.name}</summary>
            <dl className="period-budget-flows">
              <div>
                <dt>Saldo bancário na virada</dt>
                <dd>{display(account.openingBankBalance)}</dd>
              </div>
              <div>
                <dt>Créditos antecipados excluídos do saldo trazido</dt>
                <dd>{display(account.deferredOpening)}</dd>
              </div>
              <div>
                <dt>Saldo trazido ajustado</dt>
                <dd>{display(account.carried)}</dd>
              </div>
              <div>
                <dt>Créditos recebidos para períodos futuros</dt>
                <dd>{display(account.deferredClosing)}</dd>
              </div>
              <div>
                <dt>Disponível final</dt>
                <dd>{display(account.available)}</dd>
              </div>
            </dl>
            {account.reason && (
              <p>
                {reasons[account.reason] ?? 'Referência incompleta.'}{' '}
                <Link to={`/accounts/${account.accountId}`}>Conferir conta</Link>
              </p>
            )}
            {account.referenceDate && (
              <p className="field-help">Referência: {account.referenceDate}</p>
            )}
          </details>
        ))}
      </details>
    </section>
  );
}
