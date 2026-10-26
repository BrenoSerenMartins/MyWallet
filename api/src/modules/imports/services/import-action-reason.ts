import type { SettlementMetadata } from '../contracts/statement.js';
import { ediEventExplanation } from '../mappers/mercado-pago/edi-event.js';
export function importActionReason(input: {
  action: string;
  reportType: string;
  metadata: SettlementMetadata | null;
  amount: number;
  modified: boolean;
}) {
  const { action, reportType, metadata, amount, modified } = input;
  if (
    action === 'review' &&
    metadata &&
    ['SETTLEMENT', 'SETTLEMENT_SHIPPING'].includes(metadata.eventType) &&
    metadata.installmentNumber != null &&
    metadata.installmentNetAmount != null &&
    Math.abs(metadata.installmentNetAmount) !== Math.abs(amount)
  )
    return 'O valor líquido do evento difere do valor da parcela. Confira o extrato de liberação; o total da compra não será lançado como uma única parcela.';
  if (action === 'review' && metadata) {
    const explanation = ediEventExplanation(
      metadata.eventType,
      metadata.isReleased,
      amount,
      metadata,
    );
    if (explanation) return explanation;
  }
  if (modified && reportType === 'settlement')
    return 'O valor ou a data do lançamento foi alterado. Confira a diferença antes de conciliar; suas alterações serão preservadas.';
  if (reportType === 'benefit_statement' && action === 'review')
    return 'O PDF não fornece ID por compra. Confira as ocorrências antes de vincular; compras iguais no mesmo dia podem ser legítimas.';
  if (action === 'create') return 'Novo movimento identificado na fonte.';
  if (action === 'reconcile')
    return 'Vincular ao lançamento existente, preservando seus valores e categorias.';
  if (action === 'recorded') return 'Esta operação já está registrada.';
  if (action === 'ignore') return 'Registro repetido ou sem efeito financeiro.';
  return 'Confira classificação, disponibilidade ou um possível lançamento já existente.';
}
