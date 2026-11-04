import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InvestmentHolding, ManagedEntry, WealthItem } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { useFinanceWrite } from '../../../shared/api/use-finance-write';
import {
  FinanceForm,
  FinanceChoices,
  moneyInput,
  useFinanceChoices,
} from '../../../shared/ui/finance-forms';
import { CategorySelect } from '../../../shared/ui/category-select';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
import { dateToday, money, parseMoney, shortDate } from '../../../shared/formatting/money';
export const productNames = {
  fixed_income: 'Renda fixa',
  fund: 'Fundo',
  stock: 'Ação',
  etf: 'ETF',
  crypto: 'Criptoativo',
  other: 'Outro',
};
type Writer = ReturnType<typeof useFinanceWrite>;
export function HoldingForm({
  holding,
  write,
  onSaved,
}: {
  holding?: InvestmentHolding;
  write: Writer;
  onSaved: () => void;
}) {
  const [name, setName] = useState(holding?.name ?? '');
  const [provider, setProvider] = useState(holding?.provider ?? '');
  const [product, setProduct] = useState(holding?.productType ?? 'fixed_income');
  const [capital, setCapital] = useState('0,00');
  const [market, setMarket] = useState('0,00');
  const [date, setDate] = useState(dateToday());
  const [archived, setArchived] = useState(holding?.archived ?? false);
  return (
    <FinanceForm
      label={holding ? 'Salvar investimento' : 'Cadastrar investimento'}
      onSubmit={async () => {
        await write(
          holding ? `/wealth/holdings/${holding.id}` : '/wealth/holdings',
          {
            name,
            provider,
            productType: product,
            ...(holding
              ? { archived }
              : {
                  capital: parseMoney(capital),
                  marketValue: parseMoney(market),
                  valuationDate: date,
                }),
          },
          holding?.version,
          holding ? 'PATCH' : 'POST',
        );
        onSaved();
      }}
    >
      <label>
        Nome do investimento
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="CDB, fundo, ação…"
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo de investimento
          <select value={product} onChange={(e) => setProduct(e.target.value as typeof product)}>
            {Object.entries(productNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Instituição ou custódia
          <input
            maxLength={100}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Opcional"
          />
        </label>
      </div>
      {holding ? (
        <label className="finance-checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Arquivar posição zerada
        </label>
      ) : (
        <>
          <div className="form-grid">
            <label>
              Capital já investido (R$)
              <input
                required
                inputMode="decimal"
                maxLength={20}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
              />
            </label>
            <label>
              Valor total atualizado (R$)
              <input
                required
                inputMode="decimal"
                maxLength={20}
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              />
            </label>
          </div>
          <label>
            Data desse valor
            <input
              required
              type="date"
              min="1900-01-01"
              max={dateToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <p className="field-help">
            Uma posição já existente não retira dinheiro da conta novamente. Para começar uma
            aplicação nova, cadastre zerada e depois registre o aporte. Os valores são informados
            por você, sem cotação automática.
          </p>
        </>
      )}
    </FinanceForm>
  );
}
export function WealthItemForm({
  item,
  write,
  onSaved,
}: {
  item?: WealthItem;
  write: Writer;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState(item?.kind ?? 'asset');
  const [value, setValue] = useState(item ? moneyInput(item.value) : '');
  const [date, setDate] = useState(item?.valuationDate ?? dateToday());
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [archived, setArchived] = useState(item?.archived ?? false);
  return (
    <FinanceForm
      label={item ? 'Salvar posição' : 'Adicionar posição'}
      onSubmit={async () => {
        await write(
          item ? `/wealth/items/${item.id}` : '/wealth/items',
          { name, kind, value: parseMoney(value), valuationDate: date, notes, archived },
          item?.version,
          item ? 'PATCH' : 'POST',
        );
        onSaved();
      }}
    >
      <label>
        Nome do bem ou dívida
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Moto, imóvel, saldo de financiamento…"
        />
      </label>
      <label>
        Tipo da posição
        <select
          value={kind}
          disabled={!!item}
          onChange={(e) => setKind(e.target.value as 'asset' | 'debt')}
        >
          <option value="asset">Bem ou outro ativo</option>
          <option value="debt">Dívida ou obrigação</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          Valor atual informado (R$)
          <input
            required
            inputMode="decimal"
            maxLength={20}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label>
          Data da avaliação
          <input
            required
            type="date"
            min="1900-01-01"
            max={dateToday()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <label>
        Observações
        <textarea
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Origem do valor ou critério de avaliação"
        />
      </label>
      {item && (
        <label className="finance-checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Arquivar e retirar esta posição do patrimônio
        </label>
      )}
      <p className="field-help">
        Este cadastro descreve uma posição patrimonial. Não cria receita, despesa ou pagamento. Não
        repita contas, reservas, investimentos e dívidas de cartões que o app já considera.
      </p>
    </FinanceForm>
  );
}
const operationNames = {
  contribution: 'Aporte',
  redemption: 'Resgate',
  income: 'Rendimento recebido',
  valuation: 'Atualizar valor',
  capital: 'Corrigir capital',
};
export function InvestmentOperationForm({
  holding,
  initial = 'valuation',
  write,
  onSaved,
}: {
  holding: InvestmentHolding;
  initial?: keyof typeof operationNames;
  write: Writer;
  onSaved: () => void;
}) {
  const choices = useFinanceChoices();
  const [kind, setKind] = useState<keyof typeof operationNames>(initial);
  const [mode, setMode] = useState('create');
  const [account, setAccount] = useState('');
  const [date, setDate] = useState(dateToday());
  const [amount, setAmount] = useState('');
  const [removed, setRemoved] = useState('');
  const [market, setMarket] = useState(
    initial === 'valuation' ? moneyInput(holding.marketValue) : '',
  );
  const [capital, setCapital] = useState(moneyInput(holding.capital));
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [included, setIncluded] = useState(false);
  const [transaction, setTransaction] = useState('');
  const [from, setFrom] = useState(
    new Date(new Date().getTime() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(dateToday());
  const financial = ['contribution', 'redemption', 'income'].includes(kind);
  const direction = kind === 'contribution' ? 'expense' : 'income';
  const candidates = useQuery({
    queryKey: ['investment-candidates', holding.id, account, direction, from, to],
    queryFn: () =>
      request<ManagedEntry[]>(
        `/wealth/holdings/${holding.id}/candidates?${new URLSearchParams({ accountId: account, from, to, direction })}`,
      ),
    enabled: financial && mode === 'link' && !!account && !!from && !!to && from <= to,
  });
  const candidate = candidates.data?.find((t) => t.id === transaction);
  const candidateList =
    candidates.data?.filter((t) =>
      kind === 'income' ? t.transactionType === 'income' : (t.refundedAmount ?? 0) === 0,
    ) ?? [];
  let gain = 0;
  try {
    if (kind === 'redemption') gain = parseMoney(amount || '0') - parseMoney(removed || '0');
  } catch {
    /* Validation is presented on submit. */
  }
  const categoryType = kind === 'income' || gain >= 0 ? 'income' : 'expense';
  function changeKind(next: string) {
    setKind(next as keyof typeof operationNames);
    setMode('create');
    setAmount('');
    setRemoved('');
    setMarket(next === 'valuation' ? moneyInput(holding.marketValue) : '');
    setCategory('');
    setTransaction('');
    setIncluded(false);
  }
  return (
    <FinanceChoices accounts={choices.accounts} categories={choices.categories}>
      <FinanceForm
        label={
          kind === 'valuation'
            ? 'Salvar avaliação'
            : kind === 'capital'
              ? 'Corrigir capital'
              : 'Registrar movimentação'
        }
        disabled={financial && mode === 'link' && !candidate}
        onSubmit={async () => {
          const payload = {
            kind,
            date,
            ...(included ? { includedInPosition: true } : {}),
            ...(financial
              ? {
                  amount: parseMoney(amount),
                  accountId: account,
                  ...(mode === 'link'
                    ? { transactionId: candidate!.id, transactionVersion: candidate!.version }
                    : {}),
                }
              : {}),
            ...(kind === 'redemption' ? { capitalRemoved: parseMoney(removed) } : {}),
            ...(!included &&
            (kind === 'valuation' || kind === 'contribution' || kind === 'redemption') &&
            market.trim()
              ? { marketValue: parseMoney(market) }
              : {}),
            ...(kind === 'capital' ? { capital: parseMoney(capital), reason } : {}),
            ...((kind === 'income' || (kind === 'redemption' && gain !== 0)) && category
              ? { categoryId: category }
              : {}),
            ...(reason.trim() && kind !== 'capital' ? { reason } : {}),
          };
          await write(`/wealth/holdings/${holding.id}/operations`, payload, holding.version);
          onSaved();
        }}
      >
        <p>
          <strong>{holding.name}</strong> · capital {money(holding.capital)} · valor{' '}
          {money(holding.marketValue)}
        </p>
        <label>
          Operação
          <select value={kind} onChange={(e) => changeKind(e.target.value)}>
            {Object.entries(operationNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {financial && (
          <>
            <ViewSwitcher
              label="Origem da movimentação do investimento"
              value={mode}
              onChange={(v) => {
                setMode(v);
                setTransaction('');
                setIncluded(false);
              }}
              options={[
                { value: 'create', label: 'Registrar agora' },
                { value: 'link', label: 'Já está no extrato' },
              ]}
            />
            <label>
              Conta da movimentação
              <select
                required
                aria-label="Conta da movimentação"
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  setTransaction('');
                  setIncluded(false);
                }}
              >
                <option value="">Selecione a conta</option>
                {choices.accounts.data
                  ?.filter((a) => !a.archived && !a.type.startsWith('benefit_'))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            {mode === 'link' && (
              <>
                <details className="finance-period">
                  <summary>Período da busca</summary>
                  <div className="form-grid">
                    <label>
                      De
                      <input
                        type="date"
                        required
                        value={from}
                        max={to}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setTransaction('');
                        }}
                      />
                    </label>
                    <label>
                      Até
                      <input
                        type="date"
                        required
                        value={to}
                        min={from}
                        max={dateToday()}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setTransaction('');
                        }}
                      />
                    </label>
                  </div>
                </details>
                {!account ? (
                  <p>Selecione a conta para buscar o movimento.</p>
                ) : candidates.isPending ? (
                  <Loading />
                ) : candidates.isError ? (
                  <ErrorState error={candidates.error} retry={() => void candidates.refetch()} />
                ) : (
                  <label>
                    Movimento do extrato
                    <select
                      aria-label="Movimento do extrato"
                      required
                      value={transaction}
                      onChange={(e) => {
                        const entry = candidateList.find((t) => t.id === e.target.value);
                        setTransaction(e.target.value);
                        if (entry) {
                          setDate(entry.transactionDate);
                          setAmount(moneyInput(Math.abs(entry.amount)));
                        }
                      }}
                    >
                      <option value="">
                        {candidateList.length
                          ? 'Escolha o movimento'
                          : 'Nenhum movimento livre neste período'}
                      </option>
                      {candidateList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {shortDate(t.transactionDate)} · {t.description} ·{' '}
                          {money(Math.abs(t.amount))}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="field-help">
                  O movimento bancário existente será preservado. Aportes e capital de resgates
                  passam a ser transferências; somente o resultado realizado entra nas receitas ou
                  despesas.
                </p>
              </>
            )}
            <label>
              {kind === 'income'
                ? 'Rendimento recebido (R$)'
                : kind === 'redemption'
                  ? 'Valor líquido recebido (R$)'
                  : 'Valor do aporte (R$)'}
              <input
                required
                inputMode="decimal"
                maxLength={20}
                disabled={mode === 'link'}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCategory('');
                }}
              />
            </label>
          </>
        )}
        {['contribution', 'redemption'].includes(kind) && mode === 'link' && (
          <label className="finance-checkbox">
            <input
              type="checkbox"
              checked={included}
              onChange={(e) => setIncluded(e.target.checked)}
            />
            Este movimento já está incluído na posição cadastrada
          </label>
        )}
        {included && (
          <p className="field-help">
            Organiza um movimento anterior do extrato sem alterar novamente o capital e o valor
            atuais da posição. No resgate, informe o capital resgatado para separar o ganho.
          </p>
        )}
        <label>
          {kind === 'valuation' ? 'Data da avaliação' : 'Data da operação'}
          <input
            required
            type="date"
            min={
              kind === 'income' || included
                ? '1900-01-01'
                : (holding.movementFromDate ?? holding.valuationDate)
            }
            max={dateToday()}
            disabled={financial && mode === 'link'}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {kind === 'redemption' && (
          <>
            <label>
              Capital que está sendo resgatado (R$)
              <input
                required
                inputMode="decimal"
                maxLength={20}
                value={removed}
                onChange={(e) => {
                  setRemoved(e.target.value);
                  setCategory('');
                }}
              />
            </label>
            <Button
              type="button"
              className="secondary compact"
              disabled={included || !amount || !holding.marketValue}
              onClick={() => {
                try {
                  const cost = Number(
                    (BigInt(holding.capital) * BigInt(parseMoney(amount))) /
                      BigInt(holding.marketValue),
                  );
                  setRemoved(moneyInput(Math.min(holding.capital, cost)));
                  setCategory('');
                } catch {
                  setRemoved('');
                }
              }}
            >
              Estimar capital proporcional
            </Button>
            <p className="field-help">
              Confira o capital na instituição. A estimativa usa a proporção do valor cadastrado;
              ela não substitui o valor real do capital resgatado.
            </p>
            {removed && amount && (
              <p className="finance-review">
                Resultado realizado:{' '}
                <strong className={gain < 0 ? 'negative' : 'positive'}>{money(gain)}</strong>
              </p>
            )}
          </>
        )}
        {!included && ['valuation', 'contribution', 'redemption'].includes(kind) && (
          <label>
            {kind === 'valuation'
              ? 'Valor total atualizado da posição (R$)'
              : 'Valor total da posição após a operação (R$, opcional)'}
            <input
              required={kind === 'valuation'}
              inputMode="decimal"
              maxLength={20}
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder={kind === 'valuation' ? '0,00' : 'Usar estimativa pelo movimento'}
            />
          </label>
        )}
        {kind === 'capital' && (
          <>
            <label>
              Capital correto informado (R$)
              <input
                required
                inputMode="decimal"
                maxLength={20}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
              />
            </label>
            <label>
              Motivo da correção
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </>
        )}
        {((kind === 'income' && mode === 'create') || (kind === 'redemption' && gain !== 0)) && (
          <label>
            Categoria do resultado
            <CategorySelect
              categories={choices.categories.data ?? []}
              type={categoryType}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
        )}
        <p className="field-help">
          {kind === 'valuation'
            ? 'Atualiza apenas a avaliação patrimonial. Não cria dinheiro na conta nem uma receita realizada.'
            : kind === 'capital'
              ? 'Corrige o capital registrado com histórico do motivo. Não muda o valor de mercado nem movimenta a conta bancária.'
              : kind === 'income'
                ? 'Use para rendimento distribuído e recebido na conta. Para valorização da posição, use Atualizar valor.'
                : kind === 'contribution'
                  ? 'O aporte move dinheiro da conta para o investimento. Se não informar o valor total após a operação, ele será marcado como estimativa.'
                  : 'O resgate devolve capital à conta e separa ganho ou perda. Sem o valor total após a operação, a posição ficará estimada.'}
        </p>
      </FinanceForm>
    </FinanceChoices>
  );
}
