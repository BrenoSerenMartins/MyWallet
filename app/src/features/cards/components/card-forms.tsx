import { MonthPicker } from '../../../shared/ui/controls/month-picker';
import { DatePicker } from '../../../shared/ui/controls/date-picker';
import { useState } from 'react';
import type { CreditCard, CardPurchase } from '../../../shared/api/resources';
import {
  FinanceForm,
  FinanceChoices,
  moneyInput,
  useFinanceChoices,
} from '../../../shared/ui/finance-forms';
import { CategorySelect } from '../../../shared/ui/category-select';
import { dateToday, parseMoney } from '../../../shared/formatting/money';
import type { useFinanceWrite } from '../../../shared/api/use-finance-write';
type Writer = ReturnType<typeof useFinanceWrite>;
export function CardForm({
  card,
  write,
  onSaved,
}: {
  card?: CreditCard;
  write: Writer;
  onSaved: () => void;
}) {
  const choices = useFinanceChoices();
  const [name, setName] = useState(card?.name ?? '');
  const [closing, setClosing] = useState(String(card?.closingDay ?? 10));
  const [due, setDue] = useState(String(card?.dueDay ?? 20));
  const [limit, setLimit] = useState(card ? moneyInput(card.limit) : '');
  const [archived, setArchived] = useState(card?.archived ?? false);
  return (
    <FinanceChoices accounts={choices.accounts}>
      <FinanceForm
        label={card ? 'Salvar cartão' : 'Adicionar cartão'}
        onSubmit={async () => {
          await write(
            card ? `/cards/${card.id}` : '/cards',
            {
              name,
              paymentAccountId: null,
              closingDay: Number(closing),
              dueDay: Number(due),
              limit: limit.trim() ? parseMoney(limit) : 0,
              ...(card ? { archived } : {}),
            },
            card?.version,
            card ? 'PATCH' : 'POST',
          );
          onSaved();
        }}
      >
        <label>
          Nome do cartão
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meu cartão"
          />
        </label>
        <p className="field-help">
          A conta de origem é escolhida em cada pagamento ou identificada pela transação vinculada.
        </p>
        <div className="form-grid">
          <label>
            Dia de fechamento
            <input
              required
              type="number"
              min={1}
              max={31}
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
            />
          </label>
          <label>
            Dia de vencimento
            <input
              required
              type="number"
              min={1}
              max={31}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        </div>
        <label>
          Limite informado (R$)
          <input
            inputMode="decimal"
            maxLength={20}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Opcional"
          />
        </label>
        {card && (
          <label className="finance-checkbox">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Arquivar cartão quitado
          </label>
        )}
        <p className="field-help">
          Compras no dia do fechamento entram na próxima fatura. Em meses curtos, usamos o último
          dia.{' '}
          {card
            ? 'Datas de faturas já registradas serão preservadas.'
            : 'Depois de cadastrar, registre compras ou uma dívida anterior.'}{' '}
          O limite é informativo.
        </p>
      </FinanceForm>
    </FinanceChoices>
  );
}
export function CardPurchaseForm({
  card,
  write,
  onSaved,
}: {
  card: CreditCard;
  write: Writer;
  onSaved: (month?: string) => void;
}) {
  const choices = useFinanceChoices();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dateToday());
  const [installments, setInstallments] = useState('1');
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  return (
    <FinanceChoices accounts={choices.accounts} categories={choices.categories}>
      <FinanceForm
        label="Registrar compra"
        onSubmit={async () => {
          const result = await write<CardPurchase>(
            `/cards/${card.id}/purchases`,
            {
              description,
              amount: parseMoney(amount),
              purchaseDate: date,
              installments: Number(installments),
              categoryId: category || null,
              ...(month ? { firstBillMonth: month } : {}),
            },
            card.version,
          );
          onSaved(result.firstBillMonth);
        }}
      >
        <label>
          Descrição da compra
          <input
            required
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Estabelecimento ou compra"
          />
        </label>
        <div className="form-grid">
          <label>
            Valor total da compra (R$)
            <input
              required
              inputMode="decimal"
              maxLength={20}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Quantidade de parcelas
            <input
              required
              type="number"
              min={1}
              max={120}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </label>
          <label>
            Data da compra
            <DatePicker
              required
              min="1900-01-01"
              max={dateToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Categoria
            <CategorySelect
              categories={choices.categories.data ?? []}
              type="expense"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
        </div>
        <label>
          Primeira fatura (opcional)
          <MonthPicker
            min={date.slice(0, 7)}
            max="9998-12"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <p className="field-help">
          Deixe a primeira fatura em branco para calcular pelo fechamento. Informe o mês de
          vencimento se o emissor atribuiu outra fatura. Cada parcela entra como despesa no mês da
          sua fatura; a compra não retira dinheiro da conta agora.
        </p>
      </FinanceForm>
    </FinanceChoices>
  );
}
export function CardOpeningForm({
  card,
  month,
  write,
  onSaved,
}: {
  card: CreditCard;
  month: string;
  write: Writer;
  onSaved: (month?: string) => void;
}) {
  const [value, setValue] = useState('');
  const [billMonth, setMonth] = useState(month);
  return (
    <FinanceForm
      label="Registrar dívida anterior"
      onSubmit={async () => {
        await write(
          `/cards/${card.id}/opening`,
          { billMonth, amount: parseMoney(value) },
          card.version,
        );
        onSaved(billMonth);
      }}
    >
      <label>
        Valor anterior a pagar (R$)
        <input
          required
          inputMode="decimal"
          maxLength={20}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <label>
        Fatura de vencimento
        <MonthPicker
          required
          min="1900-02"
          max="9998-12"
          value={billMonth}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <p className="field-help">
        Informe apenas a dívida que ainda não foi registrada. Cada inclusão soma ao mês escolhido,
        sem criar uma despesa nova. Se houver outros valores anteriores, você pode adicioná-los
        separadamente.
      </p>
    </FinanceForm>
  );
}
