import type { ImportItem } from '../api/resources';
import { money } from '../formatting/money';
export function SettlementDetails({ metadata }: { metadata: ImportItem['metadata'] }) {
  if (!metadata) return null;
  const amount = (value: number | null) => (value === null ? 'Não informado' : money(value));
  const fields = [
    ['Evento', metadata.eventType],
    ['Data de origem', metadata.transactionTimestamp],
    ['Data de aprovação', metadata.settlementTimestamp],
    ['Valor bruto', amount(metadata.grossAmount)],
    ['Valor líquido em conta', amount(metadata.netAmount)],
    [
      'Disponibilidade informada pelo MP',
      metadata.isReleased == null
        ? 'Não informada'
        : metadata.isReleased
          ? 'Liberado'
          : 'Não liberado',
    ],
    ['Data de liberação informada', metadata.releaseTimestamp ?? 'Não informada'],
    ['Valor líquido da parcela', amount(metadata.installmentNetAmount ?? null)],
    ['Valor real', amount(metadata.realAmount)],
    ['Tarifas', amount(metadata.fees)],
    ['Impostos', amount(metadata.taxes)],
    ['Meio de pagamento', metadata.paymentMethod ?? 'Não informado'],
    ['Tipo de pagamento', metadata.paymentMethodType ?? 'Não informado'],
    ['Bandeira', metadata.brand ?? 'Não informada'],
    ['Parcelas', metadata.installments ?? 'Não informado'],
    ['Número da parcela', metadata.installmentNumber ?? 'Não informado'],
    ['Final do cartão', metadata.lastFourDigits ?? 'Não informado'],
  ];
  return (
    <details className="settlement-details">
      <summary>Detalhes da liquidação</summary>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
