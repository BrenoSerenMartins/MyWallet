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
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));

/** Dates organize the ledger; identity and amount are the primary reading path. */
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
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNames = new Map(categories.map((c) => [c.id, c]));
  const days = new Map<string, Transaction[]>();
  for (const item of items) {
    const group = days.get(item.transactionDate);
    if (group) group.push(item);
    else days.set(item.transactionDate, [item]);
  }
  return (
    <table className="movement-table" role="table">
      <caption className="sr-only">
        Movimentos registrados. Agrupados por dia; cada movimento mostra categoria, conta, valor e
        conciliação. Abra um movimento para conferir ou editar seus detalhes.
      </caption>
      <thead className="sr-only" role="rowgroup">
        <tr role="row">
          {['Movimento', 'Valor', 'Situação'].map((label, index) => (
            <th key={label} id={`${prefix}-${index}`} scope="col" role="columnheader">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      {[...days].map(([day, entries]) => (
        <tbody key={day} role="rowgroup" aria-label={date(day)}>
          <tr className="movement-day-heading" role="row">
            <th colSpan={3} scope="rowgroup" role="rowheader">
              <time dateTime={day}>{date(day)}</time>
              <span className="movement-day-count">
                {entries.length}
                <span className="sr-only">
                  {entries.length === 1
                    ? ' movimento carregado neste dia'
                    : ' movimentos carregados neste dia'}
                </span>
              </span>
            </th>
          </tr>
          {entries.map((item) => {
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
                className="movement-entry"
                role="row"
                onClick={(event) => {
                  if (!(event.target as Element).closest('button, a')) onOpen(item);
                }}
              >
                <td headers={`${prefix}-0`} role="cell" className="cell-description">
                  <div className="movement-identity">
                    <span
                      className={`movement-direction direction-${item.transactionType}`}
                      aria-hidden="true"
                    >
                      <Icon size={18} />
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
                      <div className="movement-context">
                        <span className={category ? 'movement-category-label' : 'muted'}>
                          {category ? (
                            <>
                              {category.groupName && (
                                <span className="movement-category-group">
                                  {category.groupName} /{' '}
                                </span>
                              )}
                              {category.name}
                            </>
                          ) : item.transactionType === 'transfer' ? (
                            'Transferência'
                          ) : (
                            'Sem categoria'
                          )}
                        </span>
                        <span className="movement-account-label">
                          {accountNames.get(item.accountId) ?? 'Conta'}
                        </span>
                        {(item.refundOfId ||
                          item.balanceAdjustment ||
                          item.transactionType === 'unclassified') && (
                          <span className="movement-extra-label">
                            {item.balanceAdjustment
                              ? 'Ajuste de saldo'
                              : item.refundOfId
                                ? 'Devolução vinculada'
                                : 'A revisar'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td headers={`${prefix}-1`} role="cell" className={`cell-amount ${amountTone}`}>
                  <strong>
                    {item.amount > 0 ? '+ ' : ''}
                    {money(item.amount)}
                  </strong>
                </td>
                <td headers={`${prefix}-2`} role="cell" className="cell-status">
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
      ))}
    </table>
  );
}
