import { useId } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Tag,
} from 'lucide-react';
import type { Account, Category, Transaction } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { Tooltip } from '../../../shared/ui/tooltip';

const types = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
  unclassified: 'A revisar',
};
const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T12:00:00Z`),
  );
export function MovementTable({
  items,
  accounts,
  categories,
  onOpen,
}: {
  items: Transaction[];
  accounts: Account[];
  categories: Category[];
  onOpen: (item: Transaction) => void;
}) {
  const prefix = useId();
  const columns = [
    ['date', 'Data'],
    ['description', 'Movimento'],
    ['category', 'Categoria'],
    ['account', 'Conta'],
    ['amount', 'Valor'],
    ['status', 'Situação'],
  ] as const;
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNames = new Map(categories.map((c) => [c.id, c]));
  return (
    <table className="movement-table" role="table">
      <caption className="sr-only">
        Movimentos registrados. Abra um movimento para conferir ou editar seus detalhes.
      </caption>
      <thead role="rowgroup">
        <tr role="row">
          {columns.map(([key, label]) => (
            <th
              key={key}
              id={`${prefix}-${key}`}
              scope="col"
              role="columnheader"
              className={`cell-${key}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {items.map((item) => {
          const category = categoryNames.get(item.categoryId ?? '');
          const Icon =
            item.transactionType === 'transfer'
              ? ArrowLeftRight
              : item.transactionType === 'unclassified'
                ? Tag
                : item.amount > 0
                  ? ArrowDownLeft
                  : ArrowUpRight;
          const reconciled = item.reconciliationStatus === 'reconciled';
          const status = reconciled ? 'Conferida por arquivo' : 'Pendente de conciliação';
          const details = `${types[item.transactionType]}. ${status}. ${item.importBatchId ? 'Importado de extrato.' : 'Lançamento manual.'}${item.classificationRuleId ? ' Categoria automática.' : ''}`;
          const amountTone = ['transfer', 'unclassified'].includes(item.transactionType)
            ? ''
            : item.amount >= 0
              ? 'positive-text'
              : 'negative-text';
          return (
            <tr
              key={item.id}
              role="row"
              onClick={(event) => {
                if (!(event.target as Element).closest('button, a')) onOpen(item);
              }}
            >
              <td headers={`${prefix}-date`} role="cell" className="cell-date">
                <time dateTime={item.transactionDate}>{date(item.transactionDate)}</time>
              </td>
              <td headers={`${prefix}-description`} role="cell" className="cell-description">
                <div className="movement-identity">
                  <span
                    className={`movement-direction direction-${item.transactionType}`}
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </span>
                  <div>
                    <button
                      type="button"
                      className="movement-description-button"
                      aria-label={`Abrir ${types[item.transactionType].toLocaleLowerCase('pt-BR')}: ${item.description}`}
                      onClick={() => onOpen(item)}
                    >
                      {item.description}
                    </button>
                    {(item.refundOfId ||
                      item.balanceAdjustment ||
                      item.transactionType === 'unclassified') && (
                      <small>
                        {item.balanceAdjustment
                          ? 'Ajuste de saldo'
                          : item.refundOfId
                            ? 'Devolução vinculada'
                            : 'A revisar'}
                      </small>
                    )}
                  </div>
                </div>
              </td>
              <td headers={`${prefix}-category`} role="cell" className="cell-category">
                {category ? (
                  <>
                    <span>{category.name}</span>
                    {category.groupName && <small>{category.groupName}</small>}
                  </>
                ) : (
                  <span className="muted">
                    {item.transactionType === 'transfer' ? 'Transferência' : 'Sem categoria'}
                  </span>
                )}
              </td>
              <td headers={`${prefix}-account`} role="cell" className="cell-account">
                {accountNames.get(item.accountId) ?? 'Conta'}
              </td>
              <td headers={`${prefix}-amount`} role="cell" className={`cell-amount ${amountTone}`}>
                <strong>
                  {item.amount > 0 ? '+ ' : ''}
                  {money(item.amount)}
                </strong>
              </td>
              <td headers={`${prefix}-status`} role="cell" className="cell-status">
                <Tooltip text={details} activation="help">
                  <button
                    type="button"
                    className={`movement-status ${reconciled ? 'is-reconciled' : ''}`}
                    aria-label={`Situação: ${status}`}
                  >
                    {reconciled ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                  </button>
                </Tooltip>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
