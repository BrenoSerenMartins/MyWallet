import { Link } from 'react-router-dom';
import { ArrowUpRight, Landmark } from 'lucide-react';
import type { Account } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { BalanceReference } from '../../../shared/ui/balance-reference';

export function AccountRecord({
  account: a,
  updating,
  updateDisabled,
  onUpdate,
  onHistory,
  onCorrect,
  onEdit,
}: {
  account: Account;
  updating: boolean;
  updateDisabled: boolean;
  onUpdate: () => void;
  onHistory: () => void;
  onCorrect: () => void;
  onEdit: () => void;
}) {
  const product =
    a.type === 'benefit_food'
      ? 'Vale-alimentação'
      : a.type === 'benefit_meal'
        ? 'Vale-refeição'
        : a.type === 'reserve'
          ? 'Reserva'
          : 'Conta pessoal';
  return (
    <article className="panel account-record">
      <div className="account-record-main">
        <span
          className={`bank-icon large ${a.institution === 'mercado_pago' ? 'mp' : ''}`}
          aria-hidden="true"
        >
          {a.institution === 'mercado_pago' ? 'mp' : <Landmark size={22} />}
        </span>
        <div className="account-record-identity">
          <h2>
            <Link to={`/accounts/${a.id}`}>{a.name}</Link>
          </h2>
          <p>
            {a.institution === 'mercado_pago'
              ? 'Mercado Pago'
              : a.institution === 'alelo'
                ? 'Alelo'
                : a.institution}{' '}
            · {product}
          </p>
          {a.balanceBasis?.reviewRequired ? (
            <small className="warning-text">Conferência de saldo pendente</small>
          ) : (
            a.balanceBasis?.kind === 'unknown' && (
              <small>Histórico parcial · saldo ainda não conferido</small>
            )
          )}
        </div>
        <div className="account-record-value">
          <span>Saldo registrado</span>
          <strong>{money(a.balance)}</strong>
        </div>
        <Link className="button secondary compact" to={`/accounts/${a.id}`}>
          Ver movimentações <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="account-record-actions">
        <details className="account-reference-actions">
          <summary>Referência e histórico</summary>
          <div>
            <BalanceReference account={a} />
            <button className="text-button" onClick={onHistory}>
              Histórico de saldo
            </button>
            {a.institution === 'mercado_pago' && (
              <button className="text-button" disabled={updateDisabled} onClick={onUpdate}>
                {updating ? 'Conferindo…' : 'Atualizar por extratos'}
              </button>
            )}
          </div>
        </details>
        <button className="text-button" onClick={onCorrect}>
          Corrigir saldo
        </button>
        <button className="text-button" onClick={onEdit}>
          Editar
        </button>
      </div>
    </article>
  );
}
