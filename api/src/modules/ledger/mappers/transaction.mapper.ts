import { isoDate } from '../../../core/rest/index.js';
export function transactionResource(row: Record<string, any>) {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    transactionDate: isoDate(row.transaction_date),
    description: row.description,
    amount: Number(row.amount_minor),
    transactionType: row.transaction_type,
    sourceOperationId: row.source_operation_id,
    importBatchId: row.import_batch_id,
    transferGroupId: row.transfer_group_id,
    brand: row.brand,
    installments: row.installments,
    installmentNumber: row.installment_number,
    merchant: row.merchant,
    counterparty: row.counterparty,
    version: row.version,
  };
}
