import { Tooltip } from './tooltip';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Tag,
} from 'lucide-react';
import type { Transaction } from '../api/resources';
import { money, shortDate } from '../formatting/money';
export function TransactionRow({
  transaction: t,
  hidden = false,
  onClick,
  categoryLabel,
}: {
  transaction: Transaction;
  hidden?: boolean;
  categoryLabel?: string;
  onClick?: () => void;
}) {
  const Icon =
    t.transactionType === 'transfer'
      ? ArrowLeftRight
      : t.transactionType === 'unclassified'
        ? Tag
        : t.amount > 0
          ? ArrowDownLeft
          : ArrowUpRight;
  const labels = {
    income: 'Receita',
    expense: 'Despesa',
    transfer: 'Transferência',
    unclassified: 'A revisar',
  };
  const content = (
    <>
      <span className={`transaction-icon ${t.transactionType}`}>
        <Icon size={18} />
      </span>
      <div className="transaction-description">
        <strong>{t.description}</strong>
        <span>
          {t.balanceAdjustment
            ? 'Ajuste de saldo'
            : t.refundOfId
              ? 'Devolução vinculada'
              : labels[t.transactionType]}{' '}
          · {shortDate(t.transactionDate)}
        </span>
        {categoryLabel && <span className="transaction-category">{categoryLabel}</span>}
      </div>
      <strong
        className={`transaction-amount ${t.transactionType === 'income' ? 'positive-text' : ''}`}
      >
        {hidden ? '••••' : `${t.amount > 0 ? '+ ' : ''}${money(t.amount)}`}
      </strong>
      {onClick &&
        (t.reconciliationStatus === 'reconciled' ? (
          <CheckCircle2 size={15} className="muted" aria-hidden="true" />
        ) : (
          <CircleDashed size={15} className="muted" aria-hidden="true" />
        ))}
    </>
  );
  return onClick ? (
    <Tooltip
      text={`${t.reconciliationStatus === 'reconciled' ? 'Conferida por arquivo.' : 'Pendente de conciliação.'} ${t.importBatchId ? 'Importado do extrato.' : 'Lançamento manual.'}${t.classificationRuleId ? ' Categoria automática.' : ''}`}
    >
      <button className="transaction-row" onClick={onClick}>
        {content}
      </button>
    </Tooltip>
  ) : (
    <div className="transaction-row">{content}</div>
  );
}
