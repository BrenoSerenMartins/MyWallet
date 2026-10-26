export function isEdiRefund(eventType: string) {
  return ['REFUND', 'REFUND_SHIPPING', 'CHARGEBACK', 'CHARGEBACK_SHIPPING'].includes(eventType);
}
export function ediEventExplanation(
  eventType: string,
  isReleased: boolean | null | undefined,
  amount: number,
) {
  if (isEdiRefund(eventType))
    return 'Devolução: vincule a operação original para reduzir sua receita ou despesa, sem criar uma nova receita.';
  if (eventType.startsWith('DISPUTE'))
    return 'Disputa: a indicação de contestação não comprova, sozinha, uma nova saída ou entrada. Confira o efeito líquido e a operação relacionada.';
  if (amount > 0 && isReleased !== true)
    return 'Valor ainda sem liberação comprovada no relatório. Não entra automaticamente no saldo disponível.';
  return null;
}
